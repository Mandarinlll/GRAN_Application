// Feature: data-tab, Property 4: tier 判定が granLevelToTier と一致
//
// 本機能が算出する規定階級（rankUsers の RankedUser.tier、および
// buildDistribution の区間割り当て）が、任意の 100〜999 の gran_level に対して
// granLevelToTier(granLevel) と常に一致することを検証する。
//
// Validates: Requirements 3.3, 7.2

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { granLevelToTier } from "@/features/auth/utils/classLabel";
import { rankUsers } from "@/features/data/utils/ranking";
import { buildDistribution } from "@/features/data/utils/distribution";
import type { RankableUser } from "@/features/data/types/data";

// 100〜999 の有効な GRANレベルを生成するジェネレータ。
const granLevelArb = fc.integer({ min: 100, max: 999 });

// 単一ユーザーの RankableUser を、指定レベルで構築する。
function singleUser(granLevel: number): RankableUser {
  return {
    id: "u1",
    loginId: "login1",
    nickname: "nick1",
    avatarUrl: null,
    granLevel,
    ratedMatchCount: 0,
    createdAt: "2024-01-01T00:00:00+09:00",
  };
}

describe("Property 4: tier 判定が granLevelToTier と一致", () => {
  it("rankUsers の tier は granLevelToTier(level) と一致する", () => {
    fc.assert(
      fc.property(granLevelArb, (level) => {
        const [ranked] = rankUsers([singleUser(level)]);
        expect(ranked.tier).toBe(granLevelToTier(level));
      }),
      { numRuns: 100 },
    );
  });

  it("buildDistribution では level が tier === granLevelToTier(level) の区間に落ちる", () => {
    fc.assert(
      fc.property(granLevelArb, (level) => {
        const expectedTier = granLevelToTier(level);
        const bins = buildDistribution([level]);

        // 件数が入った区間は 1 つだけで、その tier は期待値と一致する。
        const populated = bins.filter((bin) => bin.count > 0);
        expect(populated).toHaveLength(1);
        expect(populated[0].tier).toBe(expectedTier);

        // 期待 tier の区間 count は 1、その他は 0、合計は入力件数（1）。
        const expectedBin = bins.find((bin) => bin.tier === expectedTier);
        expect(expectedBin?.count).toBe(1);
        const total = bins.reduce((sum, bin) => sum + bin.count, 0);
        expect(total).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
