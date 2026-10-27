// データタブ（GRAN_Data_Tab）のビューモデル型定義。
// DB 行は snake_case、ビューモデルは camelCase に変換する。
//
// 公開プロフィールの非公開項目（本名・フリガナ・電話番号・メール・
// 生年月日・個人エントリー者本名）は、ビューモデルに一切含めないことで
// 非表示を構造的に保証する（Requirement 2.3 / 8.2 / 8.4 / Property 10）。

import type {
  TournamentTier,
  TournamentCategory,
} from "@/features/tournaments/types/tournament";

// ランキング整列に必要な素材。
export interface RankableUser {
  id: string;
  loginId: string;
  nickname: string;
  avatarUrl: string | null;
  granLevel: number; // 100〜999
  ratedMatchCount: number;
  createdAt: string;
}

// 順位付与後の表示モデル。
export interface RankedUser extends RankableUser {
  rank: number; // 1始まり。同率は同順位
  tier: TournamentTier; // granLevelToTier 準拠
  classLabel: string; // granLevelToClassLabel 準拠
}

// チーム順位の集計素材（リポジトリ戻り値）。
export interface TeamRatingRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  leaderNickname: string;
  memberLevels: number[]; // 有効 gran_level のみ
}

// チーム順位の表示モデル。
export interface RankedTeam {
  id: string;
  name: string;
  avatarUrl: string | null;
  leaderNickname: string;
  teamRating: number; // 平均レート（整数丸め）
  rank: number; // 同率は同順位。同率はリーダーニックネーム昇順
}

// レベル分布の1区間。
export interface DistributionBin {
  tier: TournamentTier;
  lower: number; // 区間下限（例: A=850）
  upper: number; // 区間上限（例: A=999）
  count: number; // 区間内人数
}

// レベル推移の1点。
export interface LevelHistoryPoint {
  tournamentTitle: string | null;
  preGranLevel: number;
  granLevelDiff: number;
  postGranLevel: number;
  recordedAt: string; // JST
}

// 成績区分（result_rank_enum）。
export type ResultRank =
  | "PARTICIPATED"
  | "L2_WINNER"
  | "T1_RUNNER_UP"
  | "T1_WINNER";

// 出場履歴の1行。
export interface EntryHistoryRow {
  tournamentTitle: string;
  eventDate: string; // YYYY-MM-DD
  category: TournamentCategory;
  tier: TournamentTier;
  rankType: ResultRank;
  granLevelDiff: number | null; // 未記録は null → UI でプレースホルダー
}

// 成績サマリ指標。
export interface PerformanceSummary {
  totalEntries: number;
  winCount: number; // rank_type = 'T1_WINNER'
  runnerUpCount: number; // rank_type = 'T1_RUNNER_UP'
  winRate: number | null; // 論点D: 当面 null（未算出）
}

// 自身サマリ（個人/階級内ランキングのヘッダ表示）。
export interface SelfRankSummary {
  granLevel: number;
  isCalibrated: boolean;
  totalCount: number; // 母集団人数
  overallRank: number | null; // 対象外（査定中）は null
  tier: TournamentTier;
  classLabel: string; // 査定中は "査定中"
}

// 期間フィルタ種別（レベル推移パネル用）。
export type PeriodFilter = "ALL" | "1Y" | "6M" | "3M";
