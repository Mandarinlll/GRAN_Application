// データタブ（GRAN_Data_Tab）のビューモデル組み立てアプリケーションサービス
// （oop-architecture.md §2.5 / §5）。
//
// 現行 data/server/dataViewData.ts の buildDataViewData を単一公開メソッドとして移設した。
// DataRepository の各 SELECT と Domain Service（RankingService / LevelDistributionService /
// PeriodFilterService）を組み合わせ、各パネル用ビューモデルと SelfRankSummary を 1 回で返す。
// 更新系は呼ばず閲覧専用を維持する（Requirement 11 / Property 14）。
// 公開ランタイムシンボルは buildDataViewData メソッドのみ。戻り値型 DataViewData は Server Action
// 戻り値型として §11 の外部契約に含まれるため本モジュールで公開する。
// "use server" を持たない純 TypeScript クラスとする。

import type { DataRepository } from "@/features/data/domain/DataRepository";
import { RankingService } from "@/features/data/domain/RankingService";
import { LevelDistributionService } from "@/features/data/domain/LevelDistributionService";
import { PeriodFilterService } from "@/features/data/domain/PeriodFilterService";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type {
  DistributionBin,
  EntryHistoryRow,
  LevelHistoryPoint,
  PeriodFilter,
  PerformanceSummary,
  RankedTeam,
  RankedUser,
  SelfRankSummary,
} from "@/features/data/types/data";
import type { CurrentUser } from "@/types/home";

// データタブ全体のビューモデル。各パネルへ props として配布する（§11 外部契約）。
export interface DataViewData {
  personalRanking: RankedUser[];
  tierRankings: Record<TournamentTier, RankedUser[]>;
  teamRanking: RankedTeam[];
  distribution: DistributionBin[];
  uncalibratedCount: number;
  levelHistory: LevelHistoryPoint[];
  entryHistory: EntryHistoryRow[];
  performanceSummary: PerformanceSummary;
  selfRankSummary: SelfRankSummary;
  selfLoginId: string;
  periodLowerBounds: Record<PeriodFilter, string | null>;
}

// 8 段階の規定階級（上位 A → 下位 DE の降順）。階級内ランキングの反復に用いる。
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
const PERIOD_FILTERS: readonly PeriodFilter[] = ["ALL", "1Y", "6M", "3M"] as const;

export class DataViewService {
  constructor(
    private readonly data: DataRepository,
    private readonly ranking: RankingService = new RankingService(),
    private readonly distribution: LevelDistributionService = new LevelDistributionService(),
    private readonly periodFilter: PeriodFilterService = new PeriodFilterService(),
  ) {}

  // 現在日時を JST の `YYYY-MM-DD HH:MM:SS` 文字列で返す（NOW_JST と同形式・辞書順=時系列順）。
  private nowJst(): string {
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

  // データタブ全体のビューモデルを組み立てる（Server）。
  // viewer: getCurrentUser() 由来の閲覧ユーザー。viewerId: users.id（UUID=session.sub）。
  buildDataViewData(viewer: CurrentUser, viewerId: string): DataViewData {
    // 個人ランキング（全体）: 査定済母集団を安定順序で整列・順位付与。
    const personalRanking = this.ranking.rankUsers(
      this.data.listPersonalRanking(),
    );

    // 階級内ランキング: 8 階級分を事前計算（各階級は査定済のみ）。
    const tierRankings = ALL_TIERS.reduce(
      (acc, tier) => {
        acc[tier] = this.ranking.rankUsers(this.data.listTierRanking(tier));
        return acc;
      },
      {} as Record<TournamentTier, RankedUser[]>,
    );

    // チームランキング: 有効メンバー 0 を除外し teamRating 降順・同率リーダー名昇順で順位付与。
    const teamRanking = this.ranking.buildTeamRanking(
      this.data.listTeamRatingRows(),
    );

    // レベル分布: 査定済ユーザーのレベルを 8 区間へ集計。
    const distribution = this.distribution.buildDistribution(
      this.data.listCalibratedLevels(),
    );
    const uncalibratedCount = this.data.countUncalibratedUsers();

    // tournament_results 依存（未整備時はフォールバック済み）。自身の users.id で絞り込む。
    const levelHistory = this.data.getLevelHistory(viewerId);
    const entryHistory = this.data.listEntryHistory(viewerId);
    const performanceSummary = this.data.getPerformanceSummary(viewerId);

    // 閲覧ユーザー自身のサマリ（自身行ハイライト・自身位置インジケータ用）。
    const selfRankSummary = this.ranking.buildSelfRankSummary(
      viewer,
      personalRanking,
    );

    // 期間フィルタ初期下限（レベル推移パネル用）。
    const now = this.nowJst();
    const periodLowerBounds = PERIOD_FILTERS.reduce(
      (acc, period) => {
        acc[period] = this.periodFilter.periodLowerBound(period, now);
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
}
