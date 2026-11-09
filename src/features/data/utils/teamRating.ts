// チーム平均レート算出の薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.3 / §5）に伴い、ロジックは data/domain/TeamRatingService へ
// 移設した。本モジュールは残置する呼び出し元を壊さないための薄い委譲ラッパである。

import { TeamRatingService } from "@/features/data/domain/TeamRatingService";

const service = new TeamRatingService();

export function computeTeamRating(memberLevels: number[]): number | null {
  return service.computeTeamRating(memberLevels);
}
