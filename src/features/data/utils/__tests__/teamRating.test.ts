// Feature: data-tab, Property 5: チーム平均レートの丸め整合
//
// For any member-level array that contains at least one valid gran_level
// (100〜999), computeTeamRating returns the arithmetic mean of the valid
// levels rounded with Math.round. An empty array (or an array whose levels
// are all out of range) returns null.
//
// Validates: Requirements 4.4

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { computeTeamRating } from "@/features/data/utils/teamRating";

const MIN_GRAN_LEVEL = 100;
const MAX_GRAN_LEVEL = 999;

function isValidGranLevel(level: number): boolean {
  return (
    Number.isFinite(level) &&
    level >= MIN_GRAN_LEVEL &&
    level <= MAX_GRAN_LEVEL
  );
}

// 有効レベル生成器（100〜999）。
const validLevelArb = fc.integer({ min: MIN_GRAN_LEVEL, max: MAX_GRAN_LEVEL });

// 範囲外レベル生成器（フィルタが働くことを確認するため）。
const outOfRangeLevelArb = fc.oneof(
  fc.integer({ min: -500, max: MIN_GRAN_LEVEL - 1 }),
  fc.integer({ min: MAX_GRAN_LEVEL + 1, max: 5000 }),
);

// 有効・範囲外を混在させた配列（有効レベルを最低1件含む）。
const mixedWithValidArb = fc
  .tuple(
    fc.array(validLevelArb, { minLength: 1, maxLength: 20 }),
    fc.array(outOfRangeLevelArb, { maxLength: 10 }),
  )
  .chain(([valids, invalids]) => {
    // 有効と無効を混ぜたうえで順序もシャッフルし、位置に依存しないことを確認する。
    const combined = [...valids, ...invalids];
    return fc.shuffledSubarray(combined, {
      minLength: combined.length,
      maxLength: combined.length,
    });
  });

describe("computeTeamRating (Property 5: チーム平均レートの丸め整合)", () => {
  it("有効レベルを1件以上含む配列では、有効レベルの算術平均を Math.round した整数を返す", () => {
    fc.assert(
      fc.property(mixedWithValidArb, (memberLevels) => {
        const validLevels = memberLevels.filter(isValidGranLevel);
        // 混在配列には必ず有効レベルが含まれる前提。
        expect(validLevels.length).toBeGreaterThan(0);

        const expected = Math.round(
          validLevels.reduce((acc, level) => acc + level, 0) /
            validLevels.length,
        );

        expect(computeTeamRating(memberLevels)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("空配列、または全て範囲外の配列では null を返す", () => {
    fc.assert(
      fc.property(
        fc.array(outOfRangeLevelArb, { maxLength: 15 }),
        (memberLevels) => {
          expect(computeTeamRating(memberLevels)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("空配列は null を返す（明示的な例）", () => {
    expect(computeTeamRating([])).toBeNull();
  });
});
