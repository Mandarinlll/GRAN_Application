// ランキング整列・順位付与の薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.3 / §5）に伴い、ロジックは data/domain/RankingService へ
// 移設した。本モジュールは残置する呼び出し元を壊さないための薄い委譲ラッパである。

import { RankingService } from "@/features/data/domain/RankingService";
import type { RankableUser, RankedUser } from "@/features/data/types/data";

const service = new RankingService();

export function rankUsers(users: RankableUser[]): RankedUser[] {
  return service.rankUsers(users);
}
