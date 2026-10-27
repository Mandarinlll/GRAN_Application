// データタブ（GRAN_Data_Tab）のデータアクセスを集約するリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6 / design.md）。
//
// 本ファイルはランキング・分布系の SELECT のみを提供し、更新系関数は一切定義しない
// （閲覧専用 / 副作用非発生 / Requirement 11.1・11.2 / Property 14）。
//
// users / teams / team_members にのみ依存するため常に算出可能であり、
// tournament_results ガード（tournamentResultsGuard.ts）の対象外である。
//
// 作法は既存リポジトリ（tournamentRepository.ts）に準拠する:
//   - db.prepare(...).all() / .get()
//   - snake_case 行 → camelCase ビューモデルへ変換
//   - 集計はサブクエリ / 集約関数で行う

import { db } from "@/lib/db";
import type {
  TournamentTier,
  TournamentCategory,
} from "@/features/tournaments/types/tournament";
import type {
  RankableUser,
  TeamRatingRow,
  LevelHistoryPoint,
  EntryHistoryRow,
  PerformanceSummary,
  ResultRank,
} from "@/features/data/types/data";
import {
  tournamentResultsTableExists,
  safeQuery,
} from "./tournamentResultsGuard";

// ランキング整列に必要な素材のみを取得する共通 SELECT カラム。
// 本名・フリガナ・電話番号・メール・生年月日は含めない（非公開項目を構造的に排除 / Property 10）。
const RANKABLE_SELECT = `
  SELECT id, login_id, nickname, avatar_url, gran_level, rated_match_count, created_at
    FROM users
`;

// 設計の安定順序（Decision 論点B）:
//   gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC
const STABLE_ORDER =
  "ORDER BY gran_level DESC, rated_match_count DESC, login_id ASC, created_at ASC";

// GRANレベル → 8段階の規定階級レンジ（下限・上限）。
// db-schema.md / requirements-detail-user.md 1.1 準拠。granLevelToTier と整合する。
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

// users 行（ランキング素材部分のみ）。
interface RankableRow {
  id: string;
  login_id: string;
  nickname: string;
  avatar_url: string | null;
  gran_level: number;
  rated_match_count: number;
  created_at: string;
}

// snake_case 行 → camelCase ビューモデル。
function toRankableUser(row: RankableRow): RankableUser {
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

// 個人ランキング（全体）の母集団素材。
// 査定済（is_level_calibrated = 1）かつ有効レンジ（100〜999）のみを安定順序で返す。
// 順位付与は utils（rankUsers）で行うため、ここでは整列済みの素材配列を返す。
export function listPersonalRanking(): RankableUser[] {
  const rows = db
    .prepare(
      `${RANKABLE_SELECT}
        WHERE is_level_calibrated = 1 AND gran_level BETWEEN 100 AND 999
        ${STABLE_ORDER}`,
    )
    .all() as RankableRow[];
  return rows.map(toRankableUser);
}

// 階級内ランキングの母集団素材。
// 指定 tier のレンジに属する査定済ユーザーのみを、同じ安定順序で返す。
export function listTierRanking(tier: TournamentTier): RankableUser[] {
  const { lower, upper } = TIER_BOUNDS[tier];
  const rows = db
    .prepare(
      `${RANKABLE_SELECT}
        WHERE is_level_calibrated = 1 AND gran_level BETWEEN ? AND ?
        ${STABLE_ORDER}`,
    )
    .all(lower, upper) as RankableRow[];
  return rows.map(toRankableUser);
}

// チーム平均レート算出素材の行。
// member_levels は有効 gran_level（100〜999）メンバーをカンマ連結した文字列。
// 有効メンバーが 0 名のチームは NULL になる（group_concat の仕様）。
interface TeamRatingQueryRow {
  id: string;
  name: string;
  avatar_url: string | null;
  leader_nickname: string;
  member_levels: string | null;
}

// カンマ連結文字列 → 有効 gran_level の number 配列。
function parseMemberLevels(raw: string | null): number[] {
  if (raw === null || raw === "") return [];
  return raw
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
}

// チームランキングの集計素材。
// 有効 gran_level（100〜999）メンバーのみを集約し、memberLevels 配列として返す。
// 平均レート算出・null 除外・順位付与は utils / ビューモデル層で行う。
// design.md の例SQL（teams JOIN leader / LEFT JOIN team_members → users with BETWEEN）に準拠。
export function listTeamRatingRows(): TeamRatingRow[] {
  const rows = db
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
    memberLevels: parseMemberLevels(row.member_levels),
  }));
}

// レベル分布用: 査定済ユーザーの gran_level 一覧。
// 区間集計（buildDistribution）は utils で実施するため、ここでは生の配列を返す。
export function listCalibratedLevels(): number[] {
  const rows = db
    .prepare(
      `SELECT gran_level
         FROM users
        WHERE is_level_calibrated = 1 AND gran_level BETWEEN 100 AND 999`,
    )
    .all() as Array<{ gran_level: number }>;
  return rows.map((row) => row.gran_level);
}

// 未査定（is_level_calibrated = 0）ユーザー数（別枠表示用）。
export function countUncalibratedUsers(): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM users WHERE is_level_calibrated = 0",
    )
    .get() as { c: number };
  return row.c;
}

// ============================================================================
// tournament_results 依存の SELECT（レベル推移 / 出場履歴 / 成績サマリ）。
//
// tournament_results は将来の正式実装まで未整備（非存在）であり得るため、各関数は
// 冒頭で tournamentResultsTableExists() を確認し、非存在なら即フォールバック値を返す。
// クエリ実行は safeQuery でラップし、実行時例外が発生してもクラッシュさせず空配列 /
// ゼロ値へフォールバックする（design.md「防御的データアクセス」/ Requirement 10.1〜10.4 /
// Property 13）。いずれも SELECT のみで副作用を発生させない（Requirement 11 / Property 14）。
//
// 集計は常に閲覧ユーザー自身（userId）の WHERE 条件で絞り込み、他ユーザーの
// レコードを一切含めない（Requirement 9.1・9.2 / Property 11）。
//
// 参照列（design.md Assumption / tournament_results スキーマ）:
//   user_id / tournament_id / pre_gran_level / gran_level_diff / post_gran_level
//   / rank_type / recorded_at
// title / category / tier / event_date は tournaments テーブルを JOIN して取得する。
// ============================================================================

// tournament_results 未整備 / 例外時の成績サマリのゼロ値（winRate は null）。
const EMPTY_PERFORMANCE_SUMMARY: PerformanceSummary = {
  totalEntries: 0,
  winCount: 0,
  runnerUpCount: 0,
  winRate: null,
};

// レベル推移クエリ行（tournament_results LEFT JOIN tournaments）。
interface LevelHistoryQueryRow {
  tournament_title: string | null;
  pre_gran_level: number;
  gran_level_diff: number;
  post_gran_level: number;
  recorded_at: string;
}

// レベル推移: 自身（userId）の変動点を recorded_at 昇順で返す。
// tournament_results 未整備または例外時は空配列へフォールバックする。
// tournaments が結び付かない場合に備え tournamentTitle は null 許容（LEFT JOIN）。
export function getLevelHistory(userId: string): LevelHistoryPoint[] {
  if (!tournamentResultsTableExists()) return [];
  return safeQuery<LevelHistoryPoint[]>([], () => {
    const rows = db
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

// 出場履歴クエリ行（tournament_results JOIN tournaments）。
// category / tier / event_date / title は tournaments に存在する列を参照する。
interface EntryHistoryQueryRow {
  tournament_title: string;
  event_date: string;
  category: TournamentCategory;
  tier: EntryHistoryRow["tier"];
  rank_type: ResultRank;
  gran_level_diff: number | null;
}

// 出場履歴: 自身（userId）の出場一覧を返す。ソート / フィルタはアプリ側（utils / Client）で
// 行うため、ここでは開催日降順で安定した素材を返す（初期表示は開催日降順を想定）。
// tournament_results 未整備または例外時は空配列へフォールバックする。
export function listEntryHistory(userId: string): EntryHistoryRow[] {
  if (!tournamentResultsTableExists()) return [];
  return safeQuery<EntryHistoryRow[]>([], () => {
    const rows = db
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

// 成績サマリ: 自身（userId）の件数集計（総出場 / 優勝 / 準優勝）を返す。
// winCount は rank_type='T1_WINNER'、runnerUpCount は rank_type='T1_RUNNER_UP' の件数。
// winRate は当面 null（未算出 / design.md 論点D）。
// tournament_results 未整備または例外時はゼロ値（winRate は null）へフォールバックする。
export function getPerformanceSummary(userId: string): PerformanceSummary {
  if (!tournamentResultsTableExists()) return EMPTY_PERFORMANCE_SUMMARY;
  return safeQuery<PerformanceSummary>(EMPTY_PERFORMANCE_SUMMARY, () => {
    const row = db
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
      // 0 件時は SUM が NULL になるため 0 に正規化する。
      winCount: row.win_count ?? 0,
      runnerUpCount: row.runner_up_count ?? 0,
      winRate: null,
    };
  });
}
