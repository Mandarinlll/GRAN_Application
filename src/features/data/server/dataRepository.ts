// データタブ用の SQL を集約したリポジトリ。
// DatabaseSync を引数注入できるため、インメモリDBでテストできる。
//
// 個人情報の扱い（要件 8.8, 11.4〜11.6）:
//  - 他ユーザーについては nickname / avatar_url / gran_level / id（と順位付けに必要な
//    rated_match_count）のみ SELECT する。real_name 等は読み出さない。
//  - 対戦相手のゲスト氏名（guest_name）は読み出さない（固定文言「ゲスト」で表示）。

import type { DatabaseSync } from "node:sqlite";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";
import type {
  ChartPointDto,
  GenderDivision,
  HistoryRowDto,
  LevelDto,
  ParticipationDetailDto,
  ParticipationRowDto,
  RankingCategory,
  RecentMatchDto,
  ResultRank,
  Surface,
} from "../types/dto";
import type { DecidedMatch } from "../utils/aggregate";
import { selectRecentMatches } from "../utils/history";
import { opponentLabel, type OpponentMember } from "../utils/opponent";
import { slicePage } from "../utils/pagination";
import {
  filterParticipations,
  sortParticipations,
  type ParticipationFilter,
} from "../utils/participation";
import {
  rankByCompetition,
  rankWithinTier,
  toRankingRowDto,
  type PublicRankingRowDto,
  type RankCandidate,
} from "../utils/ranking";
import { computePromotion, tierLowerBound, tierUpperBound } from "../utils/tier";
import { ApiError } from "./handlers";

const TEAM_CATEGORIES: readonly TournamentCategory[] = [
  "MEN_TEAM",
  "WOMEN_TEAM",
  "MIX_TEAM",
];
const RESULT_RANKS: readonly ResultRank[] = [
  "PARTICIPATED",
  "L2_WINNER",
  "T1_RUNNER_UP",
  "T1_WINNER",
];
const GENDER_DIVISIONS: readonly GenderDivision[] = ["MEN", "WOMEN", "MIXED"];
const SURFACES: readonly Surface[] = ["HARD", "CLAY", "ARTIFICIAL_GRASS", "OTHER"];

const MIN_LEVEL = 100;
const MAX_LEVEL = 999;
const RECENT_RATE_MATCHES = 10;
const ID_CHUNK = 500;

type Row = Record<string, unknown>;

const isTeam = (c: string): boolean =>
  (TEAM_CATEGORIES as readonly string[]).includes(c);
const asDivision = (v: unknown): GenderDivision | null =>
  (GENDER_DIVISIONS as readonly unknown[]).includes(v) ? (v as GenderDivision) : null;
const asSurface = (v: unknown): Surface | null =>
  (SURFACES as readonly unknown[]).includes(v) ? (v as Surface) : null;
const asResult = (v: unknown): ResultRank | null =>
  (RESULT_RANKS as readonly unknown[]).includes(v) ? (v as ResultRank) : null;
const inLevelRange = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= MIN_LEVEL && n <= MAX_LEVEL;

// 当該ユーザーが参加した「不戦でない」試合（ユーザー視点）。
// ブロックされたエントリー(CANCELLED/WAITING)は含めない。
const USER_MATCH_FROM = `
  FROM entry_members self
  JOIN entries e ON e.id = self.entry_id AND e.status IN ('CONFIRMED','ATTENDED')
  JOIN tournament_matches m ON self.entry_id IN (m.entry1_id, m.entry2_id)
  JOIN tournaments t ON t.id = m.tournament_id
 WHERE self.user_id = ? AND self.member_type = 'REGISTERED'
   AND m.entry1_id IS NOT NULL AND m.entry2_id IS NOT NULL
`;

const DECIDED_COND = `
   AND m.match_status = 'FINISHED'
   AND m.winner_entry_id IS NOT NULL
   AND m.winner_entry_id IN (m.entry1_id, m.entry2_id)
`;

// 参加済み（出場履歴の対象）エントリーの条件
const PARTICIPATED_FROM = `
  FROM entries e
  JOIN entry_members em ON em.entry_id = e.id
                       AND em.user_id = ? AND em.member_type = 'REGISTERED'
  JOIN tournaments t ON t.id = e.tournament_id
 WHERE e.status IN ('CONFIRMED','ATTENDED')
   AND t.event_date <= date('now', '+9 hours')
`;

export interface GranHistoryPage {
  rows: HistoryRowDto[];
  total: number;
  nextOffset: number | null;
  chart?: ChartPointDto[];
}

export interface RecordSummary {
  total: number;
  wins: number;
  losses: number;
  recent: RecentMatchDto[];
}

export interface ParticipationQuery extends ParticipationFilter {
  order?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export interface ParticipationPage {
  rows: ParticipationRowDto[];
  total: number;
  nextOffset: number | null;
  years: number[];
}

export interface RankingPage {
  rows: PublicRankingRowDto[];
  total: number;
  nextOffset: number | null;
  me: { rank: number; total: number } | null;
}

interface OpponentInfo {
  teamName: string | null;
  members: OpponentMember[];
}

export function createDataRepository(db: DatabaseSync) {
  const all = (sql: string, ...params: Array<string | number>): Row[] =>
    db.prepare(sql).all(...params) as Row[];
  const one = (sql: string, ...params: Array<string | number>): Row | undefined =>
    db.prepare(sql).get(...params) as Row | undefined;

  // 対戦相手エントリーの表示用情報（ニックネームとチーム名のみ）を一括取得する。
  function loadOpponents(entryIds: string[]): Map<string, OpponentInfo> {
    const result = new Map<string, OpponentInfo>();
    const unique = [...new Set(entryIds)];
    for (let i = 0; i < unique.length; i += ID_CHUNK) {
      const chunk = unique.slice(i, i + ID_CHUNK);
      const ph = chunk.map(() => "?").join(",");
      const teams = all(
        `SELECT e.id AS entry_id, tm.name AS team_name
           FROM entries e LEFT JOIN teams tm ON tm.id = e.team_id
          WHERE e.id IN (${ph})`,
        ...chunk,
      );
      for (const r of teams) {
        result.set(String(r.entry_id), {
          teamName: (r.team_name as string | null) ?? null,
          members: [],
        });
      }
      const members = all(
        `SELECT em.entry_id, em.member_type, u.nickname
           FROM entry_members em LEFT JOIN users u ON u.id = em.user_id
          WHERE em.entry_id IN (${ph})
          ORDER BY em.entry_id, em.order_no`,
        ...chunk,
      );
      for (const r of members) {
        const info = result.get(String(r.entry_id));
        const type = r.member_type;
        if (!info) continue;
        if (type !== "REGISTERED" && type !== "GUEST" && type !== "PENDING") continue;
        info.members.push({
          memberType: type,
          nickname: (r.nickname as string | null) ?? null,
        });
      }
    }
    return result;
  }

  function labelFor(
    opponents: Map<string, OpponentInfo>,
    entryId: string,
    category: string,
  ): string {
    const info = opponents.get(entryId);
    return opponentLabel({
      isTeamMatch: isTeam(category),
      teamName: info?.teamName ?? null,
      members: info?.members ?? [],
    });
  }

  return {
    // ---- マイデータ ----

    getLevel(userId: string): LevelDto {
      const r = one(
        "SELECT gran_level, is_level_calibrated FROM users WHERE id = ?",
        userId,
      );
      if (!r) throw new ApiError("NOT_FOUND", "ユーザーが見つかりません。");
      const granLevel = r.gran_level as number;
      const { tier, next } = computePromotion(granLevel);
      return {
        granLevel,
        isCalibrated: Number(r.is_level_calibrated) === 1,
        tier,
        next,
      };
    },

    // offset = 0 のときのみグラフ用に全件（古い順）を chart として返す。
    getGranHistory(userId: string, offset: number, limit: number): GranHistoryPage {
      const base = `
        FROM tournament_results r
        JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.user_id = ?
         AND r.pre_gran_level  BETWEEN ${MIN_LEVEL} AND ${MAX_LEVEL}
         AND r.post_gran_level BETWEEN ${MIN_LEVEL} AND ${MAX_LEVEL}`;
      const total = Number(one(`SELECT COUNT(*) AS c ${base}`, userId)?.c ?? 0);
      const safeOffset = Math.max(0, Math.floor(offset));
      const safeLimit = Math.max(0, Math.floor(limit));
      const rows = all(
        `SELECT r.id, r.recorded_at, t.title, r.pre_gran_level, r.gran_level_diff, r.post_gran_level
           ${base}
          ORDER BY r.recorded_at DESC, r.rowid DESC
          LIMIT ? OFFSET ?`,
        userId,
        safeLimit,
        safeOffset,
      ).map(
        (r): HistoryRowDto => ({
          id: String(r.id),
          recordedAt: String(r.recorded_at),
          tournamentTitle: String(r.title),
          preLevel: r.pre_gran_level as number,
          diff: r.gran_level_diff as number,
          postLevel: r.post_gran_level as number,
        }),
      );
      const end = safeOffset + rows.length;
      const page: GranHistoryPage = {
        rows,
        total,
        nextOffset: end < total && safeLimit > 0 ? end : null,
      };
      if (safeOffset === 0) {
        page.chart = all(
          `SELECT r.recorded_at, t.title, r.post_gran_level
             ${base}
            ORDER BY r.recorded_at ASC, r.rowid ASC`,
          userId,
        ).map(
          (r): ChartPointDto => ({
            recordedAt: String(r.recorded_at),
            tournamentTitle: String(r.title),
            postLevel: r.post_gran_level as number,
          }),
        );
      }
      return page;
    },

    // 通算勝敗（勝者確定済み FINISHED 試合のみ）と直近5試合。
    getRecord(userId: string): RecordSummary {
      const rows = all(
        `SELECT m.id AS match_id, m.score_detail, m.created_at, m.rowid AS seq,
                m.entry1_id, m.entry2_id, m.winner_entry_id, self.entry_id AS my_entry_id,
                t.title, t.event_date, t.category
           ${USER_MATCH_FROM} ${DECIDED_COND}`,
        userId,
      );
      const wins = rows.filter((r) => r.winner_entry_id === r.my_entry_id).length;

      const candidates = rows.map((r) => ({
        r,
        eventDate: String(r.event_date),
        createdAt: String(r.created_at),
        seq: r.seq as number,
      }));
      const recentRows = selectRecentMatches(candidates, 5);
      const oppId = (r: Row): string =>
        String(r.entry1_id === r.my_entry_id ? r.entry2_id : r.entry1_id);
      const opponents = loadOpponents(recentRows.map((c) => oppId(c.r)));

      const recent = recentRows.map(
        ({ r }): RecentMatchDto => ({
          matchId: String(r.match_id),
          eventDate: String(r.event_date),
          tournamentTitle: String(r.title),
          opponent: labelFor(opponents, oppId(r), String(r.category)),
          result: r.winner_entry_id === r.my_entry_id ? "WIN" : "LOSS",
          score: (r.score_detail as string | null) ?? null,
        }),
      );
      return { total: rows.length, wins, losses: rows.length - wins, recent };
    },

    // 条件別勝率の集計入力（aggregateByDimension に渡す）。
    getDecidedMatches(userId: string): DecidedMatch[] {
      const rows = all(
        `SELECT m.id AS match_id, m.entry1_id, m.entry2_id, m.winner_entry_id,
                self.entry_id AS my_entry_id,
                t.category, t.gender_division, t.venue, t.surface, t.event_date,
                s.name AS series_name
           ${USER_MATCH_FROM.replace(
             "JOIN tournaments t ON t.id = m.tournament_id",
             `JOIN tournaments t ON t.id = m.tournament_id
  LEFT JOIN tournament_series s ON s.id = t.series_id`,
           )} ${DECIDED_COND}`,
        userId,
      );
      const oppId = (r: Row): string =>
        String(r.entry1_id === r.my_entry_id ? r.entry2_id : r.entry1_id);
      const teamRows = rows.filter((r) => isTeam(String(r.category)));
      const opponents = loadOpponents(teamRows.map(oppId));

      return rows.map((r): DecidedMatch => {
        const category = String(r.category) as TournamentCategory;
        return {
          matchId: String(r.match_id),
          isWin: r.winner_entry_id === r.my_entry_id,
          tournamentCategory: category,
          genderDivision: asDivision(r.gender_division),
          venue: String(r.venue ?? ""),
          surface: asSurface(r.surface),
          seriesName: (r.series_name as string | null) ?? null,
          eventDate: String(r.event_date),
          opponentTeamName: isTeam(category)
            ? (opponents.get(oppId(r))?.teamName ?? null)
            : null,
        };
      });
    },

    // ---- 出場データ ----

    listParticipations(userId: string, q: ParticipationQuery = {}): ParticipationPage {
      // 1大会1行（同一大会に複数エントリーがあっても重複させない）
      const rows = all(
        `SELECT t.id AS tournament_id, t.title, t.event_date, t.venue, t.category,
                t.gender_division, t.tier, tr.rank_type
           FROM tournaments t
           JOIN (
             SELECT DISTINCT e.tournament_id AS tid
             ${PARTICIPATED_FROM}
           ) p ON p.tid = t.id
           LEFT JOIN tournament_results tr ON tr.tournament_id = t.id AND tr.user_id = ?
          ORDER BY t.event_date DESC, t.id ASC`,
        userId,
        userId,
      ).map(
        (r): ParticipationRowDto => ({
          tournamentId: String(r.tournament_id),
          title: String(r.title),
          eventDate: String(r.event_date),
          venue: String(r.venue),
          category: String(r.category) as TournamentCategory,
          genderDivision: asDivision(r.gender_division),
          tier: String(r.tier) as TournamentTier,
          result: asResult(r.rank_type),
        }),
      );

      const years = [
        ...new Set(rows.map((r) => Number(r.eventDate.slice(0, 4)))),
      ].sort((a, b) => b - a);

      const { order = "desc", offset = 0, limit = 20, ...filter } = q;
      const sorted = sortParticipations(filterParticipations(rows, filter), order);
      const page = slicePage(sorted, offset, limit);
      return {
        rows: page.items,
        total: page.total,
        nextOffset: page.nextOffset,
        years,
      };
    },

    // 本人が出場していない大会は NOT_FOUND。
    getParticipationDetail(userId: string, tournamentId: string): ParticipationDetailDto {
      const t = one(
        `SELECT t.id AS tournament_id, t.title, t.event_date, t.venue, t.category,
                t.gender_division, t.tier
           FROM tournaments t
          WHERE t.id = ?
            AND EXISTS (
              SELECT 1 ${PARTICIPATED_FROM} AND e.tournament_id = ?
            )`,
        tournamentId,
        userId,
        tournamentId,
      );
      if (!t) throw new ApiError("NOT_FOUND", "出場データが見つかりません。");

      const res = one(
        `SELECT rank_type, pre_gran_level, gran_level_diff, post_gran_level
           FROM tournament_results WHERE tournament_id = ? AND user_id = ?`,
        tournamentId,
        userId,
      );
      const category = String(t.category);

      const matchRows = all(
        `SELECT m.round_number, m.score_detail, m.match_status, m.winner_entry_id,
                m.entry1_id, m.entry2_id, self.entry_id AS my_entry_id
           ${USER_MATCH_FROM} AND m.tournament_id = ?
          ORDER BY m.round_number ASC, m.match_number ASC, m.rowid ASC`,
        userId,
        tournamentId,
      );
      const oppId = (r: Row): string =>
        String(r.entry1_id === r.my_entry_id ? r.entry2_id : r.entry1_id);
      const opponents = loadOpponents(matchRows.map(oppId));

      const matches = matchRows.map((r) => {
        let outcome: "WIN" | "LOSS" | "DRAW" | "UNDECIDED" = "UNDECIDED";
        if (r.match_status === "FINISHED") {
          if (r.winner_entry_id == null) outcome = "DRAW";
          else outcome = r.winner_entry_id === r.my_entry_id ? "WIN" : "LOSS";
        }
        return {
          round: r.round_number as number,
          opponent: labelFor(opponents, oppId(r), category),
          score: (r.score_detail as string | null) ?? null,
          outcome,
        };
      });

      const confirmed =
        res != null &&
        asResult(res.rank_type) !== null &&
        inLevelRange(res.pre_gran_level) &&
        inLevelRange(res.post_gran_level);

      return {
        tournamentId: String(t.tournament_id),
        title: String(t.title),
        eventDate: String(t.event_date),
        venue: String(t.venue),
        category: category as TournamentCategory,
        genderDivision: asDivision(t.gender_division),
        tier: String(t.tier) as TournamentTier,
        result: res ? asResult(res.rank_type) : null,
        matches,
        granChange: confirmed
          ? {
              pre: res!.pre_gran_level as number,
              diff: res!.gran_level_diff as number,
              post: res!.post_gran_level as number,
            }
          : null,
        isResultConfirmed: confirmed,
      };
    },

    // ---- ランキング ----

    getTierRanking(
      userId: string,
      tier: TournamentTier,
      offset: number,
      limit: number,
    ): RankingPage {
      const lo = tierLowerBound(tier);
      const hi = tierUpperBound(tier);
      // 他ユーザーの公開項目のみ（順位付けのタイブレークに rated_match_count を使用）
      const users = all(
        `SELECT id, nickname, avatar_url, gran_level, rated_match_count
           FROM users
          WHERE is_level_calibrated = 1 AND status = 'ACTIVE'
            AND gran_level BETWEEN ? AND ?`,
        lo,
        hi,
      );

      // 直近10試合（勝者確定済み）の勝敗
      const recent = new Map<string, { wins: number; total: number }>();
      const recentRows = all(
        `WITH um AS (
           SELECT self.user_id AS uid,
                  (m.winner_entry_id = self.entry_id) AS is_win,
                  t.event_date AS event_date, m.created_at AS created_at, m.rowid AS seq
             FROM entry_members self
             JOIN entries e ON e.id = self.entry_id AND e.status IN ('CONFIRMED','ATTENDED')
             JOIN tournament_matches m ON self.entry_id IN (m.entry1_id, m.entry2_id)
             JOIN tournaments t ON t.id = m.tournament_id
            WHERE self.member_type = 'REGISTERED'
              AND m.entry1_id IS NOT NULL AND m.entry2_id IS NOT NULL
              AND m.match_status = 'FINISHED'
              AND m.winner_entry_id IS NOT NULL
              AND m.winner_entry_id IN (m.entry1_id, m.entry2_id)
              AND self.user_id IN (
                SELECT id FROM users
                 WHERE is_level_calibrated = 1 AND status = 'ACTIVE'
                   AND gran_level BETWEEN ? AND ?)
         ), ranked AS (
           SELECT uid, is_win,
                  ROW_NUMBER() OVER (
                    PARTITION BY uid ORDER BY event_date DESC, created_at DESC, seq DESC
                  ) AS rn
             FROM um
         )
         SELECT uid, SUM(is_win) AS wins, COUNT(*) AS total
           FROM ranked WHERE rn <= ${RECENT_RATE_MATCHES} GROUP BY uid`,
        lo,
        hi,
      );
      for (const r of recentRows) {
        recent.set(String(r.uid), {
          wins: Number(r.wins),
          total: Number(r.total),
        });
      }

      const info = new Map<string, { nickname: string; avatarUrl: string | null }>();
      const candidates: RankCandidate[] = [];
      for (const u of users) {
        if (!inLevelRange(u.gran_level)) continue;
        const id = String(u.id);
        info.set(id, {
          nickname: String(u.nickname),
          avatarUrl: (u.avatar_url as string | null) ?? null,
        });
        const rc = recent.get(id);
        candidates.push({
          userId: id,
          granLevel: u.gran_level,
          ratedMatchCount: Number(u.rated_match_count ?? 0),
          recentWins: rc?.wins ?? 0,
          recentTotal: rc?.total ?? 0,
          isLevelCalibrated: true,
        });
      }

      const ranked = rankWithinTier(candidates, tier).map((c) => ({
        rank: c.rank,
        userId: c.userId,
        nickname: info.get(c.userId)!.nickname,
        avatarUrl: info.get(c.userId)!.avatarUrl,
        granLevel: c.granLevel,
      }));
      return toRankingPage(ranked, userId, offset, limit);
    },

    getCategoryRanking(
      userId: string,
      category: RankingCategory,
      offset: number,
      limit: number,
    ): RankingPage {
      // 種目 = ユーザーの性別区分（MEN→MALE, WOMEN→FEMALE, MIXED→全員）。gender は SELECT しない。
      const genderCond =
        category === "MEN"
          ? "AND gender = 'MALE'"
          : category === "WOMEN"
            ? "AND gender = 'FEMALE'"
            : "";
      const users = all(
        `SELECT id, nickname, avatar_url, gran_level
           FROM users
          WHERE is_level_calibrated = 1 AND status = 'ACTIVE'
            AND gran_level BETWEEN ${MIN_LEVEL} AND ${MAX_LEVEL} ${genderCond}
          ORDER BY gran_level DESC, id ASC`,
      )
        .filter((u) => inLevelRange(u.gran_level))
        .map((u) => ({
          userId: String(u.id),
          nickname: String(u.nickname),
          avatarUrl: (u.avatar_url as string | null) ?? null,
          granLevel: u.gran_level as number,
        }));
      return toRankingPage(rankByCompetition(users), userId, offset, limit);
    },
  };
}

function toRankingPage(
  ranked: Array<{
    rank: number;
    userId: string;
    nickname: string;
    avatarUrl: string | null;
    granLevel: number;
  }>,
  myUserId: string,
  offset: number,
  limit: number,
): RankingPage {
  const page = slicePage(ranked, offset, limit);
  const mine = ranked.find((r) => r.userId === myUserId);
  return {
    rows: page.items.map((r) => toRankingRowDto(r, myUserId)),
    total: page.total,
    nextOffset: page.nextOffset,
    me: mine ? { rank: mine.rank, total: ranked.length } : null,
  };
}

export type DataRepository = ReturnType<typeof createDataRepository>;
