// レベル分布の区間集計のドメインサービス（oop-architecture.md §2.3 / §5）。
//
// 現行 data/utils/distribution.ts の buildDistribution を 1:1 で移植した。区間判定は
// 共有ドメイン基盤 GranLevel.toTier() に委譲し（data → auth のクロス import を解消・§8-3/§8-4）、
// 境界判定の二重定義を避ける。各区間の count はその範囲に属するレベル件数、全区間 count の
// 合計は入力件数に一致する（Property 8）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import { GranLevel } from "@/domain/GranLevel";
import type { DistributionBin } from "@/features/data/types/data";
import type { TournamentTier } from "@/features/tournaments/types/tournament";

// 8 段階の規定階級境界（下限・上限）。GranLevel.toTier() の連続区間（下限値判定）と一致させる。
// 表示順は上位階級（A）から下位階級（DE）の降順とする。
const TIER_BOUNDS: readonly {
  tier: TournamentTier;
  lower: number;
  upper: number;
}[] = [
  { tier: "A", lower: 850, upper: 999 },
  { tier: "AB", lower: 750, upper: 849 },
  { tier: "B", lower: 650, upper: 749 },
  { tier: "BC", lower: 550, upper: 649 },
  { tier: "C", lower: 450, upper: 549 },
  { tier: "CD", lower: 350, upper: 449 },
  { tier: "D", lower: 250, upper: 349 },
  { tier: "DE", lower: 100, upper: 249 },
] as const;

export class LevelDistributionService {
  // レベル集合を 8 段階の規定階級区間ごとに集計する（常に 8 区間を A→DE の降順で返す）。
  buildDistribution(levels: number[]): DistributionBin[] {
    const counts: Record<TournamentTier, number> = {
      A: 0,
      AB: 0,
      B: 0,
      BC: 0,
      C: 0,
      CD: 0,
      D: 0,
      DE: 0,
    };

    for (const level of levels) {
      const tier = new GranLevel(level).toTier();
      counts[tier] += 1;
    }

    return TIER_BOUNDS.map(({ tier, lower, upper }) => ({
      tier,
      lower,
      upper,
      count: counts[tier],
    }));
  }
}
