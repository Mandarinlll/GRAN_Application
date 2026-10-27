// データタブ（GRAN_Data_Tab）: ランキング整列・順位付与のプロパティテスト。
//
// 設計 Decision（論点B / 同率時順序）に基づく安定順序:
//   gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC
// 順位（rank）は 1 始まりで、gran_level が同一の要素には同一順位を付与する。

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { rankUsers } from "@/features/data/utils/ranking";
import type { RankableUser } from "@/features/data/types/data";

// RankableUser を生成するジェネレータ。
// - granLevel: 100〜999（査定済ユーザーの有効レンジ）
// - ratedMatchCount: 0 以上
// - loginId: 区別しやすいよう英数字文字列（衝突も自然に起こりうる）
// - createdAt: ISO 風の日付文字列（辞書順 = 時系列順になる形式）
const rankableUserArb: fc.Arbitrary<RankableUser> = fc.record({
  id: fc.uuid(),
  loginId: fc.string({ minLength: 1, maxLength: 8 }),
  nickname: fc.string({ maxLength: 12 }),
  avatarUrl: fc.option(fc.webUrl(), { nil: null }),
  granLevel: fc.integer({ min: 100, max: 999 }),
  ratedMatchCount: fc.integer({ min: 0, max: 500 }),
  createdAt: fc
    .date({
      min: new Date("2020-01-01T00:00:00.000Z"),
      max: new Date("2025-12-31T23:59:59.999Z"),
    })
    .map((d) => d.toISOString()),
});

// 設計の安定順序比較関数（テスト側の独立実装）。
function expectedOrder(a: RankableUser, b: RankableUser): number {
  if (a.granLevel !== b.granLevel) return b.granLevel - a.granLevel; // DESC
  if (a.ratedMatchCount !== b.ratedMatchCount)
    return b.ratedMatchCount - a.ratedMatchCount; // DESC
  if (a.loginId !== b.loginId) return a.loginId < b.loginId ? -1 : 1; // ASC
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1; // ASC
  return 0;
}

describe("rankUsers", () => {
  // Feature: data-tab, Property 1: ランキングの安定順序（単調性 + タイブレーク）
  // Validates: Requirements 2.1, 2.9, 3.2, 3.6
  it("Property 1: 出力は gran_level DESC → rated_match_count DESC → login_id ASC の安定順序で並び、同率 gran_level は同一の 1 始まり順位を共有する", () => {
    fc.assert(
      fc.property(fc.array(rankableUserArb, { maxLength: 40 }), (users) => {
        const ranked = rankUsers(users);

        // 入力件数を保存する。
        expect(ranked.length).toBe(users.length);

        for (let i = 1; i < ranked.length; i += 1) {
          const prev = ranked[i - 1];
          const curr = ranked[i];

          // 1) gran_level は降順（単調非増加）。
          expect(prev.granLevel).toBeGreaterThanOrEqual(curr.granLevel);

          // 2) gran_level 同一のときは rated_match_count 降順、
          //    さらに同一なら login_id 昇順のタイブレーク。
          if (prev.granLevel === curr.granLevel) {
            if (prev.ratedMatchCount === curr.ratedMatchCount) {
              expect(prev.loginId <= curr.loginId).toBe(true);
            } else {
              expect(prev.ratedMatchCount).toBeGreaterThanOrEqual(
                curr.ratedMatchCount,
              );
            }
          }

          // 隣接要素は設計の比較関数に対して非逆転（安定順序）である。
          expect(expectedOrder(prev, curr)).toBeLessThanOrEqual(0);
        }

        // 3) rank は 1 始まり。先頭要素が存在するなら rank === 1。
        if (ranked.length > 0) {
          expect(ranked[0].rank).toBe(1);
        }

        for (let i = 0; i < ranked.length; i += 1) {
          const curr = ranked[i];

          // rank は常に 1 以上。
          expect(curr.rank).toBeGreaterThanOrEqual(1);

          // 同率（gran_level 同一）は同順位を共有する。
          if (i > 0) {
            const prev = ranked[i - 1];
            if (prev.granLevel === curr.granLevel) {
              expect(curr.rank).toBe(prev.rank);
            } else {
              // gran_level が異なる要素が現れた時点で、
              // rank はそれまでの出現件数 +1（= i + 1）に更新される。
              expect(curr.rank).toBe(i + 1);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
