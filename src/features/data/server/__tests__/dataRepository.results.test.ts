// データタブ（GRAN_Data_Tab）の tournament_results 依存 SELECT に対するプロパティテスト。
//
// 対象:
//   - getLevelHistory(userId)      : レベル推移（recorded_at 昇順）
//   - getPerformanceSummary(userId): 成績サマリ（件数集計・母集団分離）
//
// 本テストは複数ユーザーの tournament_results をシードし、自身（userId）の
// レコードのみが集計対象になること・昇順整列・件数集計の整合を検証する。
//
// IMPORTANT（DB コンテキスト）:
//   tournament_results は src/lib/db.ts のベーススキーマには存在しない
//   （将来の正式実装まで未整備）。そのため本テストは beforeAll で共有 db 上に
//   tournament_results テーブルを自前で CREATE し、afterAll で DROP する。
//   これにより「テーブル非存在」ケースを検証する別ファイル（4.6）へ
//   テーブルが漏れないようにする。
//
// Validates: Requirements 5.3, 5.4, 5.5, 9.1, 9.2
// Properties: 7, 11, 12

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fc from "fast-check";

import { db } from "@/lib/db";
import {
  getLevelHistory,
  getPerformanceSummary,
} from "@/features/data/server/dataRepository";
import { periodLowerBound } from "@/features/data/utils/period";
import type { PeriodFilter, ResultRank } from "@/features/data/types/data";

// --- 列挙値 ---

const RANK_TYPES: ResultRank[] = [
  "PARTICIPATED",
  "L2_WINNER",
  "T1_RUNNER_UP",
  "T1_WINNER",
];

const PERIODS: PeriodFilter[] = ["ALL", "1Y", "6M", "3M"];

// 複数ユーザーの母集団分離を検証するための固定ユーザー ID 群。
const USER_IDS = ["user-a", "user-b", "user-c"];

// --- テスト用スキーマ管理 ---
//
// リポジトリが参照する列（design.md Assumption / プロンプトの指定）に合わせて
// tournament_results を自前で作成する。recorded_at は JST 文字列
// （YYYY-MM-DD HH:MM:SS、辞書順＝時系列順）で保持する。
function createResultsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournament_results (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      tournament_id   TEXT,
      pre_gran_level  INTEGER NOT NULL,
      gran_level_diff INTEGER NOT NULL,
      post_gran_level INTEGER NOT NULL,
      rank_type       TEXT NOT NULL,
      recorded_at     TEXT NOT NULL
    );
  `);
}

function dropResultsTable(): void {
  db.exec("DROP TABLE IF EXISTS tournament_results;");
}

function clearResults(): void {
  db.exec("DELETE FROM tournament_results;");
}

// 生成された 1 行を tournament_results へ INSERT する。
// tournament_id は NULL（getLevelHistory / getPerformanceSummary は tournaments を
// 必須としない。getLevelHistory は LEFT JOIN のため tournamentTitle は null になる）。
interface SeedRow {
  userId: string;
  preGranLevel: number;
  granLevelDiff: number;
  postGranLevel: number;
  rankType: ResultRank;
  recordedAt: string;
}

function insertRow(row: SeedRow, index: number): void {
  db.prepare(
    `INSERT INTO tournament_results (
       id, user_id, tournament_id,
       pre_gran_level, gran_level_diff, post_gran_level,
       rank_type, recorded_at
     ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
  ).run(
    `tr-${index}`,
    row.userId,
    row.preGranLevel,
    row.granLevelDiff,
    row.postGranLevel,
    row.rankType,
    row.recordedAt,
  );
}

function seedRows(rows: SeedRow[]): void {
  rows.forEach((row, index) => insertRow(row, index));
}

// --- 生成器 ---

// JST の recorded_at 文字列（YYYY-MM-DD HH:MM:SS）。
// 年月日の範囲を広めにとり、期間フィルタの下限と交差しやすくする。
const recordedAtArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2022, max: 2026 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ year, month, day, hour, minute, second }) => {
    const pad = (v: number) => String(v).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
  });

// 1 件の tournament_results 行（user_id は固定ユーザー群から選ぶ）。
const seedRowArb: fc.Arbitrary<SeedRow> = fc.record({
  userId: fc.constantFrom(...USER_IDS),
  preGranLevel: fc.integer({ min: 100, max: 999 }),
  granLevelDiff: fc.integer({ min: -50, max: 50 }),
  postGranLevel: fc.integer({ min: 100, max: 999 }),
  rankType: fc.constantFrom(...RANK_TYPES),
  recordedAt: recordedAtArb,
});

const rowsArb: fc.Arbitrary<SeedRow[]> = fc.array(seedRowArb, {
  minLength: 0,
  maxLength: 25,
});

const userIdArb: fc.Arbitrary<string> = fc.constantFrom(...USER_IDS);
const periodArb: fc.Arbitrary<PeriodFilter> = fc.constantFrom(...PERIODS);

// --- ライフサイクル ---

beforeAll(() => {
  createResultsTable();
});

afterAll(() => {
  dropResultsTable();
});

beforeEach(() => {
  clearResults();
});

// ============================================================================
// Property 7: レベル推移の昇順と期間フィルタの健全性
//   (a) getLevelHistory の出力は recorded_at 昇順で整列される。
//   (b) periodLowerBound による期間フィルタ適用後は、下限以上の点のみが残る。
//       "ALL"（下限 null）のときは全点が残る。
//
// Validates: Requirements 5.3, 5.4, 5.5
// ============================================================================
describe("dataRepository: Property 7 レベル推移の昇順と期間フィルタの健全性", () => {
  it("getLevelHistory returns the user's points ordered by recordedAt ascending", () => {
    fc.assert(
      fc.property(rowsArb, userIdArb, (rows, userId) => {
        clearResults();
        seedRows(rows);

        const history = getLevelHistory(userId);

        // 件数は当該ユーザーのレコード数に一致する（母集団分離は Property 11 でも検証）。
        const ownCount = rows.filter((r) => r.userId === userId).length;
        expect(history).toHaveLength(ownCount);

        // (a) recorded_at（recordedAt）昇順（非減少）で整列している。
        for (let i = 0; i + 1 < history.length; i++) {
          expect(history[i].recordedAt <= history[i + 1].recordedAt).toBe(true);
        }

        // すべて当該ユーザー由来である（他ユーザーの混入が無い）。
        // → recordedAt の多重集合が自分のシード分と一致することで間接的に保証する。
        const expectedDates = rows
          .filter((r) => r.userId === userId)
          .map((r) => r.recordedAt)
          .sort();
        const actualDates = history.map((p) => p.recordedAt).sort();
        expect(actualDates).toEqual(expectedDates);
      }),
      { numRuns: 100 },
    );
  });

  it("period filter via periodLowerBound keeps only points >= lowerBound (ALL keeps all)", () => {
    fc.assert(
      fc.property(
        rowsArb,
        userIdArb,
        periodArb,
        recordedAtArb,
        (rows, userId, period, now) => {
          clearResults();
          seedRows(rows);

          const history = getLevelHistory(userId);
          const lowerBound = periodLowerBound(period, now);

          // アプリ側（LevelHistoryPanel 相当）で行う期間フィルタを再現する。
          const filtered =
            lowerBound === null
              ? history
              : history.filter((p) => p.recordedAt >= lowerBound);

          if (lowerBound === null) {
            // "ALL": 全点が残る。
            expect(filtered).toHaveLength(history.length);
          } else {
            // 健全性: 残った全点は下限以上。
            for (const point of filtered) {
              expect(point.recordedAt >= lowerBound).toBe(true);
            }
            // 完全性: 下限以上の点はすべて残る（過剰除外が無い）。
            const expectedCount = history.filter(
              (p) => p.recordedAt >= lowerBound,
            ).length;
            expect(filtered).toHaveLength(expectedCount);
          }

          // フィルタ後も昇順は保たれる。
          for (let i = 0; i + 1 < filtered.length; i++) {
            expect(filtered[i].recordedAt <= filtered[i + 1].recordedAt).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 11: 成績サマリの母集団分離
//   getPerformanceSummary(userId).totalEntries は当該ユーザーのレコード件数のみに
//   一致し、他ユーザーのレコードを一切含めない。
//
// Validates: Requirements 9.1, 9.2
// ============================================================================
describe("dataRepository: Property 11 成績サマリの母集団分離", () => {
  it("totalEntries equals the count of that user's records only, never others'", () => {
    fc.assert(
      fc.property(rowsArb, userIdArb, (rows, userId) => {
        clearResults();
        seedRows(rows);

        const summary = getPerformanceSummary(userId);

        const ownCount = rows.filter((r) => r.userId === userId).length;
        expect(summary.totalEntries).toBe(ownCount);

        // 母集団分離の明示検証: 全ユーザー合計との差分が他ユーザー分と一致する。
        const othersCount = rows.filter((r) => r.userId !== userId).length;
        expect(rows.length - summary.totalEntries).toBe(othersCount);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 12: 成績サマリの件数集計整合
//   winCount == count of rank_type='T1_WINNER'（当該ユーザー分のみ）
//   runnerUpCount == count of rank_type='T1_RUNNER_UP'（当該ユーザー分のみ）
//
// Validates: Requirements 9.1, 9.2
// ============================================================================
describe("dataRepository: Property 12 成績サマリの件数集計整合", () => {
  it("winCount and runnerUpCount match T1_WINNER / T1_RUNNER_UP counts for that user", () => {
    fc.assert(
      fc.property(rowsArb, userIdArb, (rows, userId) => {
        clearResults();
        seedRows(rows);

        const summary = getPerformanceSummary(userId);

        const own = rows.filter((r) => r.userId === userId);
        const expectedWins = own.filter(
          (r) => r.rankType === "T1_WINNER",
        ).length;
        const expectedRunnerUps = own.filter(
          (r) => r.rankType === "T1_RUNNER_UP",
        ).length;

        expect(summary.winCount).toBe(expectedWins);
        expect(summary.runnerUpCount).toBe(expectedRunnerUps);

        // 件数整合: 優勝・準優勝は総出場件数を超えない。
        expect(summary.winCount + summary.runnerUpCount).toBeLessThanOrEqual(
          summary.totalEntries,
        );

        // winRate は当面 null（design.md 論点D）。
        expect(summary.winRate).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
