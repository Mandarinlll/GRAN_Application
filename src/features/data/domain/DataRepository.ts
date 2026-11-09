// データタブ（GRAN_Data_Tab）のデータアクセス抽象（oop-architecture.md §2.4）。
//
// 閲覧専用（SELECT のみ・副作用非発生 / Property 14）。ランキング・分布系は常に算出可能、
// tournament_results 依存（レベル推移 / 出場履歴 / 成績サマリ）は未整備・例外時に
// 空配列 / ゼロ値へフォールバックする（実装側の防御的データアクセスに隠蔽・Property 13）。
// 戻り値はすべてプレーン DTO。DB・Zod・Next.js に依存しない純粋な TypeScript とする。

import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type {
  EntryHistoryRow,
  LevelHistoryPoint,
  PerformanceSummary,
  RankableUser,
  TeamRatingRow,
} from "@/features/data/types/data";

export interface DataRepository {
  // 個人ランキング母集団素材（査定済・有効レンジ・安定順序）。
  listPersonalRanking(): RankableUser[];
  // 階級内ランキング母集団素材（指定 tier・査定済・安定順序）。
  listTierRanking(tier: TournamentTier): RankableUser[];
  // チームランキング集計素材（有効 gran_level メンバーのみ）。
  listTeamRatingRows(): TeamRatingRow[];
  // レベル分布素材（査定済ユーザーの gran_level 一覧）。
  listCalibratedLevels(): number[];
  // 未査定ユーザー数（別枠表示用）。
  countUncalibratedUsers(): number;
  // レベル推移（自身・recorded_at 昇順。未整備/例外時は空配列）。
  getLevelHistory(userId: string): LevelHistoryPoint[];
  // 出場履歴（自身・開催日降順の素材。未整備/例外時は空配列）。
  listEntryHistory(userId: string): EntryHistoryRow[];
  // 成績サマリ（自身・未整備/例外時はゼロ値 / winRate=null）。
  getPerformanceSummary(userId: string): PerformanceSummary;
}
