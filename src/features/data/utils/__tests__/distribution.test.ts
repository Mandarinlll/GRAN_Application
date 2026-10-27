import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildDistribution } from "@/features/data/utils/distribution";
import type { TournamentTier } from "@/features/tournaments/types/tournament";

// 8 段階の規定階級境界（設計 / requirements 7.2 に一致）。
//   A:850〜999 / AB:750〜849 / B:650〜749 / BC:550〜649 /
//   C:450〜549 / CD:350〜449 / D:250〜349 / DE:100〜249
// 表示順は上位階級（A）から下位階級（DE）の降順。
const EXPECTED_BOUNDS: readonly { tier: TournamentTier; lower: number; upper: number }[] = [
  { tier: "A", lower: 850, upper: 999 },
  { tier: "AB", lower: 750, upper: 849 },
  { tier: "B", lower: 650, upper: 749 },
  { tier: "BC", lower: 550, upper: 649 },
  { tier: "C", lower: 450, upper: 549 },
  { tier: "CD", lower: 350, upper: 449 },
  { tier: "D", lower: 250, upper: 349 },
  { tier: "DE", lower: 100, upper: 249 },
];

describe("buildDistribution", () => {
  // Feature: data-tab, Property 8: レベル分布の区間正当性と件数保存
  // For any 査定済ユーザーのレベル集合に対し、buildDistribution の各区間は
  // 8 段階の規定階級境界に一致し、各区間の count はその区間範囲に属する
  // レベルの件数に等しく、全区間の count の合計は入力レベル件数に等しい。
  // Validates: Requirements 7.1, 7.2
  it("bins match the 8 tier boundaries, per-range counts are correct, and total count is conserved", () => {
    fc.assert(
      fc.property(
        // 100〜999 の有効 GRANレベル配列（空集合・同一値・全区間跨ぎを自然に網羅）。
        fc.array(fc.integer({ min: 100, max: 999 })),
        (levels) => {
          const bins = buildDistribution(levels);

          // 常に 8 区間を A→DE の降順で返す。
          expect(bins).toHaveLength(EXPECTED_BOUNDS.length);

          // 各区間の tier / lower / upper が規定境界に一致する（順序含む）。
          bins.forEach((bin, i) => {
            const expected = EXPECTED_BOUNDS[i];
            expect(bin.tier).toBe(expected.tier);
            expect(bin.lower).toBe(expected.lower);
            expect(bin.upper).toBe(expected.upper);
          });

          // 各区間の count は、その区間 [lower, upper] に属するレベル件数に等しい。
          for (const bin of bins) {
            const expectedCount = levels.filter(
              (level) => level >= bin.lower && level <= bin.upper,
            ).length;
            expect(bin.count).toBe(expectedCount);
          }

          // 件数保存: 全区間 count の合計は入力件数に一致する。
          const totalCount = bins.reduce((sum, bin) => sum + bin.count, 0);
          expect(totalCount).toBe(levels.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
