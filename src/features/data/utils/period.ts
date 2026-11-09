// 期間フィルタ境界算出の薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.3 / §5）に伴い、ロジックは data/domain/PeriodFilterService へ
// 移設した。本モジュールは残置する呼び出し元を壊さないための薄い委譲ラッパである。

import { PeriodFilterService } from "@/features/data/domain/PeriodFilterService";
import type { PeriodFilter } from "@/features/data/types/data";

export type { PeriodFilter };

const service = new PeriodFilterService();

export function periodLowerBound(
  period: PeriodFilter,
  now: string,
): string | null {
  return service.periodLowerBound(period, now);
}
