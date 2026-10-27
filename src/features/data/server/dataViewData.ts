// データタブ（GRAN_Data_Tab）のビューモデル組み立て層（Server）。
//
// dataRepository（SELECT のみ）の呼び出しと utils（純粋関数）を組み合わせ、
// 各パネル（個人ランキング / 階級内ランキング / チームランキング / レベル分布 /
// レベル推移 / 出場履歴 / 成績サマリ）用のビューモデルと、閲覧ユーザー自身の
// サマリ（SelfRankSummary）を 1 回の呼び出しで組み立てる。
//
// 本層は Server 専用であり、SQL は一切持たない（SQL は dataRepository.ts に集約）。
// 更新系は呼び出さず、閲覧専用を維持する（Requirement 11 / Property 14）。
//
// 設計 Decision との対応:
//   - 論点C（未査定ユーザー）: 母集団は dataRepository 側で is_level_calibrated=1 に
//     限定済み。査定中の閲覧ユーザーは overallRank=null / classLabel="査定中"。
//   - 論点B（同率時順序）: rankUsers（utils）の安定順序に委譲。
//   - 論点A（チーム指標）: computeTeamRating（有効メンバー平均・四捨五入、0 名は null→除外）。
//   - 論点E（期間フィルタ）: periodLowerBound（レベル推移パネルで利用する下限を提供）。
//
// _Requirements: 2.5, 2.6, 3.4, 4.7, 7.4, 7.5, 9.1_ / _Properties: 1, 5, 6, 8_

import {
  listPersonalRanking,
  listTierRanking,
  listTeamRatingRows,
  listCalibratedLevels,
  countUncalibratedUsers,
  getLevelHistory,
  listEntryHistory,
  getPerformanceSummary,
} from "@/features/data/server/dataRepository";
import { rankUsers } from "@/features/data/utils/ranking";
import { computeTeamRating } from "@/features/data/utils/teamRating";
import { buildDistribution } from "@/features/data/utils/distribution";
import { periodLowerBound } from "@/features/data/utils/period";
import {
  granLevelToTier,
  granLevelToClassLabel,
} from "@/features/auth/utils/classLabel";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type {
  RankedUser,
  RankedTeam,
  DistributionBin,
  LevelHistoryPoint,
  EntryHistoryRow,
  PerformanceSummary,
  SelfRankSummary,
  PeriodFilter,
} from "@/features/data/types/data";
import type { CurrentUser } from "@/types/home";

// 8 段階の規定階級（上位 A → 下位 DE の降順）。階級内ランキングを全階級分
// 事前計算する際の反復に用いる。
const ALL_TIERS: readonly TournamentTier[] = [
  "A",
  "AB",
  "B",
  "BC",
  "C",
  "CD",
  "D",
  "DE",
] as const;

// レベル推移パネルの期間フィルタ初期選択肢（設計 Decision 論点E）。
// 各選択肢に対応する下限 recorded_at（全期間は null）を事前算出して渡す。
const PERIOD_FILTERS: readonly PeriodFilter[] = ["ALL", "1Y", "6M", "3M"] as const;

// データタブ全体のビューモデル。各パネルへ props として配布する。
export interface DataViewData {
  // 個人ランキング（全体・査定済のみ・順位付与済み）。
  personalRanking: RankedUser[];
  // 階級内ランキング（8 階級分を事前計算）。キーは TournamentTier。
  tierRankings: Record<TournamentTier, RankedUser[]>;
  // チームランキング（有効メンバー 0 のチームを除外・順位付与済み）。
  teamRanking: RankedTeam[];
  // レベル分布（8 区間・件数集計済み）。
  distribution: DistributionBin[];
  // 未査定（別枠表示用）ユーザー数。
  uncalibratedCount: number;
  // レベル推移（自身・recorded_at 昇順。未整備時は空配列）。
  levelHistory: LevelHistoryPoint[];
  // 出場履歴（自身・開催日降順の素材。ソート/フィルタは Client）。
  entryHistory: EntryHistoryRow[];
  // 成績サマリ（自身・未整備時はゼロ値 / winRate=null）。
  performanceSummary: PerformanceSummary;
  // 閲覧ユーザー自身のサマリ（全体ランキング基準。査定中は overallRank=null）。
  selfRankSummary: SelfRankSummary;
  // 閲覧ユーザー自身の loginId（CurrentUser.displayId）。個人ランキングの
  // 自身行ハイライト判定に用いる（SelfRankSummary は loginId を持たないため別途保持）。
  selfLoginId: string;
  // レベル推移の期間フィルタ初期下限（選択肢 → 下限 recorded_at）。
  periodLowerBounds: Record<PeriodFilter, string | null>;
}

// 現在日時を JST の `YYYY-MM-DD HH:MM:SS` 文字列で返す。
// DB の NOW_JST（datetime('now','+9 hours')）と同形式（辞書順＝時系列順）。
// periodLowerBound へ渡す now として用いる。
function nowJst(): string {
  const utcMs = Date.now();
  const jst = new Date(utcMs + 9 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  const y = jst.getUTCFullYear();
  const mo = pad(jst.getUTCMonth() + 1);
  const d = pad(jst.getUTCDate());
  const h = pad(jst.getUTCHours());
  const mi = pad(jst.getUTCMinutes());
  const s = pad(jst.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * チーム順位行をチームランキングのビューモデルへ整列・順位付与する。
 *
 * - computeTeamRating が null（有効メンバー 0 名）のチームは除外する（Requirement 4.6）。
 * - teamRating 降順、同率はリーダーニックネーム昇順で整列する（Requirement 4.7）。
 * - 順位は 1 始まりで付与し、同一 teamRating のチームには同一順位を付与する
 *   （standard competition ranking / Requirement 4.7 / Property 6）。
 *
 * @param rows listTeamRatingRows() の戻り値（memberLevels は有効 gran_level のみ）
 */
function buildTeamRanking(
  rows: ReturnType<typeof listTeamRatingRows>,
): RankedTeam[] {
  // 有効メンバー 0 名（computeTeamRating=null）のチームを除外しつつ平均レートを付与。
  const rated = rows
    .map((row) => {
      const teamRating = computeTeamRating(row.memberLevels);
      if (teamRating === null) return null;
      return {
        id: row.id,
        name: row.name,
        avatarUrl: row.avatarUrl,
        leaderNickname: row.leaderNickname,
        teamRating,
      };
    })
    .filter((team): team is Omit<RankedTeam, "rank"> => team !== null);

  // teamRating 降順 → リーダーニックネーム昇順で安定整列。
  rated.sort((a, b) => {
    if (a.teamRating !== b.teamRating) {
      return b.teamRating - a.teamRating; // DESC
    }
    if (a.leaderNickname !== b.leaderNickname) {
      return a.leaderNickname < b.leaderNickname ? -1 : 1; // ASC
    }
    return 0;
  });

  // 同一 teamRating には同一順位を付与（standard competition ranking）。
  const result: RankedTeam[] = [];
  let currentRank = 0;
  let prevRating: number | null = null;
  for (let i = 0; i < rated.length; i += 1) {
    const team = rated[i];
    if (prevRating === null || team.teamRating !== prevRating) {
      currentRank = i + 1;
      prevRating = team.teamRating;
    }
    result.push({ ...team, rank: currentRank });
  }

  return result;
}

/**
 * 閲覧ユーザー自身のサマリ（全体ランキング基準）を組み立てる。
 *
 * - overallRank: 全体ランキング（査定済母集団）内で自身の loginId に一致する行の rank。
 *   自身が母集団に含まれない（査定中 / 対象外）場合は null（Requirement 2.6）。
 * - totalCount: 母集団人数（査定済ユーザー数）。
 * - granLevel: 閲覧ユーザー自身の GRANレベル（母集団外でも表示 / Requirement 2.6）。
 * - tier / classLabel: 査定済は granLevelToTier / granLevelToClassLabel。
 *   査定中は classLabel="査定中"（getCurrentUser と整合 / Requirement 7.5）。
 *
 * @param viewer getCurrentUser() 由来の閲覧ユーザー
 * @param ranking rankUsers(listPersonalRanking()) の結果（査定済母集団・順位付与済み）
 */
function buildSelfRankSummary(
  viewer: CurrentUser,
  ranking: RankedUser[],
): SelfRankSummary {
  // getCurrentUser は未査定時に classLabel="査定中" を返すため、これを査定状態の判定に用いる。
  const isCalibrated = viewer.classLabel !== "査定中";
  const totalCount = ranking.length;

  // 自身の行は loginId（CurrentUser.displayId）で突き合わせる。
  // 査定中ユーザーは母集団（査定済のみ）に含まれないため見つからず null になる。
  const selfRow = isCalibrated
    ? ranking.find((user) => user.loginId === viewer.displayId)
    : undefined;

  return {
    granLevel: viewer.granLevel,
    isCalibrated,
    totalCount,
    overallRank: selfRow?.rank ?? null,
    tier: granLevelToTier(viewer.granLevel),
    classLabel: isCalibrated
      ? granLevelToClassLabel(viewer.granLevel)
      : "査定中",
  };
}

/**
 * データタブ全体のビューモデルを組み立てる（Server）。
 *
 * dataRepository の各 SELECT と utils（rankUsers / computeTeamRating →
 * RankedTeam 整列 / buildDistribution / periodLowerBound）を組み合わせ、
 * 各パネル用ビューモデルと SelfRankSummary を 1 回で返す。
 *
 * tournament_results 依存（レベル推移 / 出場履歴 / 成績サマリ）は dataRepository 側で
 * 未整備時のフォールバック（空配列 / ゼロ値）が保証されるため、本層は結果をそのまま配布する。
 *
 * @param viewer getCurrentUser() 由来の閲覧ユーザー（認証済み前提）。
 *   自身行ハイライト・自身位置インジケータ・SelfRankSummary に用いる。
 * @param viewerId 閲覧ユーザーの users.id（UUID）。tournament_results は user_id=users.id で
 *   絞り込むため、loginId ではなく UUID を受け取る（CurrentUser は id を保持しないため別引数）。
 *   page.tsx 側でセッション（session.sub）から解決して渡す。
 */
export function buildDataViewData(
  viewer: CurrentUser,
  viewerId: string,
): DataViewData {
  // 個人ランキング（全体）: 査定済母集団を安定順序で整列・順位付与。
  const personalRanking = rankUsers(listPersonalRanking());

  // 階級内ランキング: 8 階級分を事前計算（各階級は査定済のみ）。
  const tierRankings = ALL_TIERS.reduce(
    (acc, tier) => {
      acc[tier] = rankUsers(listTierRanking(tier));
      return acc;
    },
    {} as Record<TournamentTier, RankedUser[]>,
  );

  // チームランキング: 有効メンバー 0 を除外し teamRating 降順・同率リーダー名昇順で順位付与。
  const teamRanking = buildTeamRanking(listTeamRatingRows());

  // レベル分布: 査定済ユーザーのレベルを 8 区間へ集計。
  const distribution = buildDistribution(listCalibratedLevels());
  const uncalibratedCount = countUncalibratedUsers();

  // tournament_results 依存（未整備時はフォールバック済み）。自身の users.id で絞り込む。
  const levelHistory = getLevelHistory(viewerId);
  const entryHistory = listEntryHistory(viewerId);
  const performanceSummary = getPerformanceSummary(viewerId);

  // 閲覧ユーザー自身のサマリ（自身行ハイライト・自身位置インジケータ用）。
  const selfRankSummary = buildSelfRankSummary(viewer, personalRanking);

  // 期間フィルタ初期下限（レベル推移パネル用）。
  const now = nowJst();
  const periodLowerBounds = PERIOD_FILTERS.reduce(
    (acc, period) => {
      acc[period] = periodLowerBound(period, now);
      return acc;
    },
    {} as Record<PeriodFilter, string | null>,
  );

  return {
    personalRanking,
    tierRankings,
    teamRanking,
    distribution,
    uncalibratedCount,
    levelHistory,
    entryHistory,
    performanceSummary,
    selfRankSummary,
    selfLoginId: viewer.displayId,
    periodLowerBounds,
  };
}
