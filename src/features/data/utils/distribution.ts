// レベル分布の区間集計（純粋関数）。
//
// 8 段階の規定階級境界ごとに件数を集計する。区間境界は
// `granLevelToTier`（src/features/auth/utils/classLabel.ts）と整合させ、
// 新たな境界値をここで定義しない（設計方針「既存ロジックの再利用」）。
//
// 各区間の count はその区間範囲に属するレベルの件数に等しく、
// 全区間の count の合計は入力レベル件数に一致する（Property 8）。

import { granLevelToTier } from "@/features/auth/utils/classLabel";
import type { DistributionBin } from "@/features/data/types/data";
import type { TournamentTier } from "@/features/tournaments/types/tournament";

// 8 段階の規定階級境界（下限・上限）。
// granLevelToTier の連続区間（下限値判定）と一致させる：
//   A:850〜999 / AB:750〜849 / B:650〜749 / BC:550〜649 /
//   C:450〜549 / CD:350〜449 / D:250〜349 / DE:100〜249
// 表示順は上位階級（A）から下位階級（DE）の降順とする。
const TIER_BOUNDS: readonly { tier: TournamentTier; lower: number; upper: number }[] = [
  { tier: "A", lower: 850, upper: 999 },
  { tier: "AB", lower: 750, upper: 849 },
  { tier: "B", lower: 650, upper: 749 },
  { tier: "BC", lower: 550, upper: 649 },
  { tier: "C", lower: 450, upper: 549 },
  { tier: "CD", lower: 350, upper: 449 },
  { tier: "D", lower: 250, upper: 349 },
  { tier: "DE", lower: 100, upper: 249 },
] as const;

// レベル集合を 8 段階の規定階級区間ごとに集計する。
// 区間判定は granLevelToTier に委譲し、境界判定の二重定義を避ける。
// 戻り値は常に 8 区間（該当者 0 名の区間は count=0）を A→DE の降順で返す。
export function buildDistribution(levels: number[]): DistributionBin[] {
  // tier → count の初期化（全区間 0）。
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
    const tier = granLevelToTier(level);
    counts[tier] += 1;
  }

  return TIER_BOUNDS.map(({ tier, lower, upper }) => ({
    tier,
    lower,
    upper,
    count: counts[tier],
  }));
}
