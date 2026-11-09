// レベル分布の区間集計の薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.3 / §5）に伴い、ロジックは
// data/domain/LevelDistributionService へ移設した（区間判定は共有 GranLevel に委譲し、
// data → auth のクロス import を解消）。本モジュールは残置する呼び出し元向けの薄い委譲ラッパ。

import { LevelDistributionService } from "@/features/data/domain/LevelDistributionService";
import type { DistributionBin } from "@/features/data/types/data";

const service = new LevelDistributionService();

export function buildDistribution(levels: number[]): DistributionBin[] {
  return service.buildDistribution(levels);
}
