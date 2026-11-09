// DataRepository の SQLite 実装（oop-architecture.md §2.4）。
// SQL はこの層にのみ閉じ込める（既存規約 §6）。
//
// 現行 data/server/dataRepository.ts の SELECT・行→DTO 変換を 1:1 で移植した。
// tournament_results 依存クエリは、未整備（非存在）や実行時例外でクラッシュさせないため、
// テーブル存在チェック（tableExists）と安全実行ラッパ（safeQuery）を private に持つ
// （防御的データアクセス / Property 13）。閲覧専用・SELECT のみ（Property 14）。

import type { DatabaseSync } from "node:sqlite";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";
import type {
  EntryHistoryRow,
  LevelHistoryPoint,
  PerformanceSummary,
  RankableUser,
  ResultRank,
  TeamRatingRow,
} from "@/features/data/types/data";
import type { DataRepository } from "@/features/data/domain/DataRepository";

// ランキング整列に必要な素材のみを取得する共通 SELECT カラム。
// 非公開項目（本名・フリガナ・電話番号・メール・生年月日）は含めない（Property 10）。
const RANKABLE_SELECT = `
  SELECT id, login_id, nickname, avatar_url, gran_level, rated_match_count, created_at
    FROM users
`;

// 設計の安定順序（Decision 論点B）:
//   gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC
const STABLE_ORDER =
  "ORDER BY gran_level DESC, rated_match_count DESC, login_id ASC, created_at ASC";

// GRANレベル → 8段階の規定階級レンジ（下限・上限）。GranLevel.toTier() と整合する。
const TIER_BOUNDS: Record<TournamentTier, { lower: number; upper: number }> = {
  A: { lower: 850, upper: 999 },
  AB: { lower: 750, upper: 849 },
  B: { lower: 650, upper: 749 },
  BC: { lower: 550, upper: 649 },
  C: { lower: 450, upper: 549 },
  CD: { lower: 350, upper: 449 },
  D: { lower: 250, upper: 349 },
  DE: { lower: 100, upper: 249 },
};

interface RankableRow {
  id: string;
  login_id: string;
  nickname: string;
  avatar_url: string | null;
  gran_level: number;
  rated_match_count: number;
  created_at: string;
}

interface TeamRatingQueryRow {
  id: string;
  name: string;
  avatar_url: string | null;
  leader_nickname: string;
  member_levels: string | null;
}

interface LevelHistoryQueryRow {
  tournament_title: string | null;
  pre_gran_level: number;
  gran_level_diff: number;
  post_gran_level: number;
  recorded_at: string;
}

interface EntryHistoryQueryRow {
  tournament_title: string;
  event_date: string;
  category: TournamentCategory;
  tier: EntryHistoryRow["tier"];
  rank_type: ResultRank;
  gran_level_diff: number | null;
}

// tournament_results 未整備 / 例外時の成績サマリのゼロ値（winRate は null）。
const EMPTY_PERFORMANCE_SUMMARY: PerformanceSummary = {
  totalEntries: 0,
  winCount: 0,
  runnerUpCount: 0,
  winRate: null,
};

export class SqliteDataRepository implements DataRepository {
  constructor(private readonly db: DatabaseSync) {}

  // snake_case 行 → camelCase ビューモデル。
  private toRankableUser(row: RankableRow): RankableUser {
    return {
      id: row.id,
      loginId: row.login_id,
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      granLevel: row.gran_level,
      ratedMatchCount: row.rated_match_count,
      createdAt: row.created_at,
    };
  }

  // カンマ連結文字列 → 有効 gran_level の number 配列。
  private parseMemberLevels(raw: string | null): number[] {
    if (raw === null || raw === "") return [];
    return raw
      .split(",")
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n));
  }

  // tournament_results テーブルが存在するか（sqlite_master を参照）。存在確認自体が
  // 例外を投げる可能性も考慮し false にフォールバックする（防御的データアクセス）。
  private tableExists(): boolean {
    try {
      const row = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='tournament_results' LIMIT 1",
        )
        .get() as { name: string } | undefined;
      return row !== undefined;
    } catch {
      return false;
    }
  }

  // tournament_results 依存クエリを安全実行するラッパ。例外時は fallback を返す。
  private safeQuery<T>(fallback: T, fn: () => T): T {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }

  listPersonalRanking(): RankableUser[] {
    const rows = this.db
      .prepare(
        `${RANKABLE_SELECT}
        WHERE is_level_calibrated = 1 AND gran_level BETWEEN 100 AND 999
        ${STABLE_ORDER}`,
      )
      .all() as RankableRow[];
    return rows.map((row) => this.toRankableUser(row));
  }

  listTierRanking(tier: TournamentTier): RankableUser[] {
    const { lower, upper } = TIER_BOUNDS[tier];
    const rows = this.db
      .prepare(
        `${RANKABLE_SELECT}
        WHERE is_level_calibrated = 1 AND gran_level BETWEEN ? AND ?
        ${STABLE_ORDER}`,
      )
      .all(lower, upper) as RankableRow[];
    return rows.map((row) => this.toRankableUser(row));
  }

  listTeamRatingRows(): TeamRatingRow[] {
    const rows = this.db
      .prepare(
        `SELECT t.id,
              t.name,
              t.avatar_url,
              u_lead.nickname AS leader_nickname,
              group_concat(um.gran_level) AS member_levels
         FROM teams t
         JOIN users u_lead ON u_lead.id = t.leader_user_id
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users um ON um.id = tm.user_id
              AND um.gran_level BETWEEN 100 AND 999
        GROUP BY t.id`,
      )
      .all() as TeamRatingQueryRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      leaderNickname: row.leader_nickname,
      memberLevels: this.parseMemberLevels(row.member_levels),
    }));
  }

  listCalibratedLevels(): number[] {
    const rows = this.db
      .prepare(
        `SELECT gran_level
         FROM users
        WHERE is_level_calibrated = 1 AND gran_level BETWEEN 100 AND 999`,
      )
      .all() as Array<{ gran_level: number }>;
    return rows.map((row) => row.gran_level);
  }

  countUncalibratedUsers(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE is_level_calibrated = 0")
      .get() as { c: number };
    return row.c;
  }

  getLevelHistory(userId: string): LevelHistoryPoint[] {
    if (!this.tableExists()) return [];
    return this.safeQuery<LevelHistoryPoint[]>([], () => {
      const rows = this.db
        .prepare(
          `SELECT t.title        AS tournament_title,
                tr.pre_gran_level,
                tr.gran_level_diff,
                tr.post_gran_level,
                tr.recorded_at
           FROM tournament_results tr
           LEFT JOIN tournaments t ON t.id = tr.tournament_id
          WHERE tr.user_id = ?
          ORDER BY tr.recorded_at ASC`,
        )
        .all(userId) as LevelHistoryQueryRow[];
      return rows.map((row) => ({
        tournamentTitle: row.tournament_title,
        preGranLevel: row.pre_gran_level,
        granLevelDiff: row.gran_level_diff,
        postGranLevel: row.post_gran_level,
        recordedAt: row.recorded_at,
      }));
    });
  }

  listEntryHistory(userId: string): EntryHistoryRow[] {
    if (!this.tableExists()) return [];
    return this.safeQuery<EntryHistoryRow[]>([], () => {
      const rows = this.db
        .prepare(
          `SELECT t.title      AS tournament_title,
                t.event_date,
                t.category,
                t.tier,
                tr.rank_type,
                tr.gran_level_diff
           FROM tournament_results tr
           JOIN tournaments t ON t.id = tr.tournament_id
          WHERE tr.user_id = ?
          ORDER BY t.event_date DESC, tr.recorded_at DESC`,
        )
        .all(userId) as EntryHistoryQueryRow[];
      return rows.map((row) => ({
        tournamentTitle: row.tournament_title,
        eventDate: row.event_date,
        category: row.category,
        tier: row.tier,
        rankType: row.rank_type,
        granLevelDiff: row.gran_level_diff,
      }));
    });
  }

  getPerformanceSummary(userId: string): PerformanceSummary {
    if (!this.tableExists()) return EMPTY_PERFORMANCE_SUMMARY;
    return this.safeQuery<PerformanceSummary>(EMPTY_PERFORMANCE_SUMMARY, () => {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS total_entries,
                SUM(CASE WHEN rank_type = 'T1_WINNER' THEN 1 ELSE 0 END) AS win_count,
                SUM(CASE WHEN rank_type = 'T1_RUNNER_UP' THEN 1 ELSE 0 END) AS runner_up_count
           FROM tournament_results
          WHERE user_id = ?`,
        )
        .get(userId) as {
        total_entries: number;
        win_count: number | null;
        runner_up_count: number | null;
      };
      return {
        totalEntries: row.total_entries,
        winCount: row.win_count ?? 0,
        runnerUpCount: row.runner_up_count ?? 0,
        winRate: null,
      };
    });
  }
}
