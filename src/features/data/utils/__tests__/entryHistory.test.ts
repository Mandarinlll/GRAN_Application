// Feature: data-tab, Property 9: 出場履歴のソート安定性とフィルタ健全性
//
// 出場履歴（EntryHistoryRow）に対するソート・フィルタ純粋関数のプロパティテスト。
//
// Property 9:
//   任意の出場履歴集合と任意のソートキー・方向・フィルタ条件に対し、
//   (a) 出力は指定キー・方向で整列される、
//   (b) ソートキーが等しい行は開催日（eventDate）の降順で安定的に並ぶ、
//   (c) フィルタ適用後の全行は指定条件（種目区分・階級）に一致する。
//
// Validates: Requirements 6.4, 6.5, 6.6

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  sortEntries,
  filterEntries,
  type EntrySortKey,
  type SortDirection,
  type EntryFilter,
} from "@/features/data/utils/entryHistory";
import type { EntryHistoryRow, ResultRank } from "@/features/data/types/data";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// --- 列挙値（実装と同じ並び順で定義し、序数比較の検証に用いる） ---

const CATEGORIES: TournamentCategory[] = [
  "MEN_TEAM",
  "WOMEN_TEAM",
  "MIX_TEAM",
  "SINGLES",
  "DOUBLES",
];

const TIERS: TournamentTier[] = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];

const RANK_TYPES: ResultRank[] = [
  "PARTICIPATED",
  "L2_WINNER",
  "T1_RUNNER_UP",
  "T1_WINNER",
];

// テスト内で独立に定義する序数（実装の内部定数に依存しないよう再掲）。
const CATEGORY_ORDER: Record<TournamentCategory, number> = {
  MEN_TEAM: 0,
  WOMEN_TEAM: 1,
  MIX_TEAM: 2,
  SINGLES: 3,
  DOUBLES: 4,
};

const RANK_TYPE_ORDER: Record<ResultRank, number> = {
  PARTICIPATED: 0,
  L2_WINNER: 1,
  T1_RUNNER_UP: 2,
  T1_WINNER: 3,
};

const SORT_KEYS: EntrySortKey[] = ["eventDate", "category", "rankType"];
const DIRECTIONS: SortDirection[] = ["asc", "desc"];

// --- 生成器 ---

// YYYY-MM-DD 形式の開催日。固定長文字列として辞書順比較が日付順と一致する。
// 衝突（タイブレーク検証）を起こしやすいよう、年月日の範囲を意図的に狭める。
const eventDateArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2023, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );

const entryRowArb: fc.Arbitrary<EntryHistoryRow> = fc.record({
  tournamentTitle: fc.string({ minLength: 1, maxLength: 10 }),
  eventDate: eventDateArb,
  category: fc.constantFrom(...CATEGORIES),
  tier: fc.constantFrom(...TIERS),
  rankType: fc.constantFrom(...RANK_TYPES),
  granLevelDiff: fc.option(fc.integer({ min: -50, max: 50 }), { nil: null }),
});

const rowsArb: fc.Arbitrary<EntryHistoryRow[]> = fc.array(entryRowArb, {
  minLength: 0,
  maxLength: 20,
});

const sortKeyArb: fc.Arbitrary<EntrySortKey> = fc.constantFrom(...SORT_KEYS);
const directionArb: fc.Arbitrary<SortDirection> = fc.constantFrom(
  ...DIRECTIONS,
);

const filterArb: fc.Arbitrary<EntryFilter> = fc.record({
  category: fc.option(fc.constantFrom(...CATEGORIES), { nil: undefined }),
  tier: fc.option(fc.constantFrom(...TIERS), { nil: undefined }),
});

// --- 序数ヘルパ（主キー比較用） ---

// 指定キーにおける「昇順序数」を返す。eventDate は文字列を直接比較する。
function keyOrdinal(
  row: EntryHistoryRow,
  key: EntrySortKey,
): number | string {
  switch (key) {
    case "eventDate":
      return row.eventDate;
    case "category":
      return CATEGORY_ORDER[row.category];
    case "rankType":
      return RANK_TYPE_ORDER[row.rankType];
  }
}

// 2 値を昇順比較（-1 / 0 / 1）。
function cmp(a: number | string, b: number | string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

describe("entryHistory: Property 9 出場履歴のソート安定性とフィルタ健全性", () => {
  // (a) + (b): 主キーが指定方向に単調整列され、主キー同値は eventDate 降順で安定する。
  it("sorts by key+direction and tie-breaks equal keys by eventDate desc (stable)", () => {
    fc.assert(
      fc.property(rowsArb, sortKeyArb, directionArb, (rows, key, direction) => {
        const sorted = sortEntries(rows, key, direction);

        // 要素の多重集合は不変（並べ替えのみで追加・欠落が無い）。
        expect(sorted).toHaveLength(rows.length);

        const factor = direction === "asc" ? 1 : -1;

        for (let i = 0; i + 1 < sorted.length; i++) {
          const a = sorted[i];
          const b = sorted[i + 1];

          // 1) 主キー（方向適用）で a <= b であること（非減少）。
          const primary = cmp(keyOrdinal(a, key), keyOrdinal(b, key)) * factor;
          expect(primary).toBeLessThanOrEqual(0);

          // 2) 主キー同値のときは eventDate 降順で安定すること。
          if (primary === 0) {
            // key が eventDate の場合、主キー同値 ⇒ eventDate 同値。
            // それ以外のキーでは eventDate は非増加（降順）でなければならない。
            expect(a.eventDate >= b.eventDate).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // (b) 詳細: eventDate も同値の場合は入力の元順序を保持する（安定ソート）。
  it("preserves original input order when key and eventDate both tie", () => {
    fc.assert(
      fc.property(rowsArb, sortKeyArb, directionArb, (rows, key, direction) => {
        // 元の index を識別するためのタグ付き配列。
        const tagged = rows.map((row, index) => ({ ...row, __idx: index }));
        const sorted = sortEntries(tagged, key, direction) as (EntryHistoryRow & {
          __idx: number;
        })[];

        for (let i = 0; i + 1 < sorted.length; i++) {
          const a = sorted[i];
          const b = sorted[i + 1];
          const sameKey = cmp(keyOrdinal(a, key), keyOrdinal(b, key)) === 0;
          const sameDate = a.eventDate === b.eventDate;
          if (sameKey && sameDate) {
            // 完全同値グループ内では元の順序（index 昇順）が保たれる。
            expect(a.__idx).toBeLessThan(b.__idx);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // (a) 不変条件: ソートは入力配列を変更しない（純粋関数）。
  it("does not mutate the input array", () => {
    fc.assert(
      fc.property(rowsArb, sortKeyArb, directionArb, (rows, key, direction) => {
        const snapshot = rows.map((r) => ({ ...r }));
        sortEntries(rows, key, direction);
        expect(rows).toEqual(snapshot);
      }),
      { numRuns: 100 },
    );
  });

  // (c): フィルタ適用後の全行が指定条件（種目区分・階級）に一致する。
  it("filtered rows all match the specified category/tier (soundness)", () => {
    fc.assert(
      fc.property(rowsArb, filterArb, (rows, filter) => {
        const filtered = filterEntries(rows, filter);

        // 健全性: 残った全行は指定条件に一致する。
        for (const row of filtered) {
          if (filter.category !== undefined) {
            expect(row.category).toBe(filter.category);
          }
          if (filter.tier !== undefined) {
            expect(row.tier).toBe(filter.tier);
          }
        }

        // 完全性: 条件に一致する元の行はすべて残る（過剰除外が無い）。
        const expectedCount = rows.filter((row) => {
          if (filter.category !== undefined && row.category !== filter.category)
            return false;
          if (filter.tier !== undefined && row.tier !== filter.tier)
            return false;
          return true;
        }).length;
        expect(filtered).toHaveLength(expectedCount);
      }),
      { numRuns: 100 },
    );
  });

  // (c) 不変条件: フィルタは入力配列を変更しない（純粋関数）。
  it("filterEntries does not mutate the input array", () => {
    fc.assert(
      fc.property(rowsArb, filterArb, (rows, filter) => {
        const snapshot = rows.map((r) => ({ ...r }));
        filterEntries(rows, filter);
        expect(rows).toEqual(snapshot);
      }),
      { numRuns: 100 },
    );
  });
});
