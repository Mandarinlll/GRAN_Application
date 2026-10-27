// データタブ（GRAN_Data_Tab）: 未整備フォールバックと副作用非発生のプロパティテスト。
//
// 対象は dataRepository.ts の tournament_results 依存 SELECT（getLevelHistory /
// listEntryHistory / getPerformanceSummary）および閲覧専用（SELECT のみ）な
// ランキング・分布系 SELECT 群。共有シングルトン db（@/lib/db）に対して検証する。
//
// Property 13: tournament_results 未整備（非存在）または実行時例外のとき、
//   履歴系関数は例外を投げず空配列 / ゼロ値（winRate は null）を返す。
// Property 14: 取得系（SELECT のみ）呼び出しの前後で、各テーブルの COUNT(*) と
//   内容（ソート済みハッシュ）が不変である（副作用非発生）。
//
// 重要:
//   - tournament_results は基本スキーマに含まれない（設計上未実装）。本ファイルは
//     beforeAll で DROP TABLE IF EXISTS し、afterAll でも DROP して「非存在」で終える。
//   - db は実ファイル data/gran.db を指すシングュルトンのため、挿入した行は
//     一意プレフィックス付き ID で区別し、テスト終了時に必ず削除して分離を保つ。

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fc from "fast-check";

import { db } from "@/lib/db";
import {
  listPersonalRanking,
  listTierRanking,
  listTeamRatingRows,
  listCalibratedLevels,
  countUncalibratedUsers,
  getLevelHistory,
  listEntryHistory,
  getPerformanceSummary,
} from "@/features/data/server/dataRepository";
import { safeQuery } from "@/features/data/server/tournamentResultsGuard";
import type { TournamentTier } from "@/features/tournaments/types/tournament";

// このテストが作成する行を識別する一意プレフィックス。
// 既存データと衝突せず、クリーンアップ対象を限定するために用いる。
const PREFIX = "test-fallback-";

const ALL_TIERS: TournamentTier[] = [
  "A",
  "AB",
  "B",
  "BC",
  "C",
  "CD",
  "D",
  "DE",
];

// このテストが挿入した行のみを安全に削除する。
// 外部キー順（team_members → teams → users）で削除する。
function cleanupInserted(): void {
  db.prepare(`DELETE FROM team_members WHERE id LIKE '${PREFIX}%'`).run();
  db.prepare(`DELETE FROM teams WHERE id LIKE '${PREFIX}%'`).run();
  db.prepare(`DELETE FROM users WHERE id LIKE '${PREFIX}%'`).run();
}

// tournament_results を確実に非存在にする（設計上このテーブルは未整備）。
function dropTournamentResults(): void {
  db.exec("DROP TABLE IF EXISTS tournament_results");
}

beforeAll(() => {
  // Property 13 の前提: tournament_results は非存在。
  dropTournamentResults();
  // 念のため残留テスト行を掃除してから開始する。
  cleanupInserted();
});

afterEach(() => {
  // Property 14 で挿入した行をプロパティ試行ごとに確実に除去する。
  cleanupInserted();
});

afterAll(() => {
  cleanupInserted();
  // 本ファイルは tournament_results を非存在のまま残す（設計上の既定状態）。
  dropTournamentResults();
});

// NOT NULL な users カラムを全て埋める挿入ヘルパ。
// gran_level は 100〜999、is_level_calibrated は 0/1 を指定可能にする。
function insertUser(args: {
  id: string;
  loginId: string;
  email: string;
  nickname: string;
  granLevel: number;
  isCalibrated: 0 | 1;
  ratedMatchCount: number;
  createdAt: string;
}): void {
  db.prepare(
    `INSERT INTO users (
       id, login_id, email, password_hash, role, is_admin, status,
       is_initial_login, real_name, kana_name, nickname,
       gran_level, is_level_calibrated, rated_match_count,
       failed_login_attempts, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'USER', 0, 'ACTIVE', 0, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    args.id,
    args.loginId,
    args.email,
    "x".repeat(16), // password_hash（NOT NULL）: ダミー
    "テスト氏名", // real_name（NOT NULL）
    "テストシメイ", // kana_name（NOT NULL）
    args.nickname,
    args.granLevel,
    args.isCalibrated,
    args.ratedMatchCount,
    args.createdAt,
    args.createdAt,
  );
}

function insertTeam(args: {
  id: string;
  name: string;
  leaderUserId: string;
  createdAt: string;
}): void {
  db.prepare(
    `INSERT INTO teams (id, name, leader_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(args.id, args.name, args.leaderUserId, args.createdAt, args.createdAt);
}

function insertTeamMember(args: {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
}): void {
  db.prepare(
    `INSERT INTO team_members (id, team_id, user_id, joined_at)
     VALUES (?, ?, ?, ?)`,
  ).run(args.id, args.teamId, args.userId, args.joinedAt);
}

// あるテーブルの件数と内容スナップショット（順序非依存ハッシュ）を取得する。
// 内容は主キー順に整列した全行を JSON 化して連結し、挿入/削除/更新を検出する。
function snapshotTable(table: string): { count: number; content: string } {
  const count = (
    db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
  ).c;
  const rows = db
    .prepare(`SELECT * FROM ${table} ORDER BY id ASC`)
    .all() as unknown[];
  return { count, content: JSON.stringify(rows) };
}

// Property 14 のスナップショット対象テーブル。
// tournament_results は本ファイルでは非存在だが、存在する場合に備え条件付きで含める。
const SNAPSHOT_TABLES = ["users", "teams", "team_members"];

describe("dataRepository fallback / 閲覧専用", () => {
  // Feature: data-tab, Property 13: 履歴データ未整備時に例外を投げない（空配列 / ゼロ値を返す）
  // Validates: Requirements 10.1, 10.2, 10.4, 11.1, 11.2
  it("Property 13: tournament_results 非存在時、履歴系は例外を投げず空配列 / ゼロ値（winRate=null）を返す", () => {
    // 前提の再確認: tournament_results は非存在。
    const exists =
      (
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='tournament_results' LIMIT 1",
          )
          .get() as { name: string } | undefined
      ) !== undefined;
    expect(exists).toBe(false);

    fc.assert(
      fc.property(
        // ランダムな userId（存在しない ID を含む任意の文字列）。
        fc.string({ minLength: 1, maxLength: 36 }),
        (userId) => {
          // いずれの呼び出しも例外を投げない。
          const history = getLevelHistory(userId);
          const entries = listEntryHistory(userId);
          const summary = getPerformanceSummary(userId);

          expect(Array.isArray(history)).toBe(true);
          expect(history).toEqual([]);

          expect(Array.isArray(entries)).toBe(true);
          expect(entries).toEqual([]);

          expect(summary).toEqual({
            totalEntries: 0,
            winCount: 0,
            runnerUpCount: 0,
            winRate: null,
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: data-tab, Property 13: safeQuery は例外時にフォールバック値を返す（例外経路の直接検証）
  // Validates: Requirements 10.1, 10.2, 10.4
  it("Property 13: safeQuery は内部 fn が例外を投げても必ず fallback を返し、throw しない", () => {
    fc.assert(
      fc.property(
        // 任意のフォールバック値（配列 / 数値 / null など）。
        fc.oneof(
          fc.constant<unknown>([]),
          fc.integer(),
          fc.constant<unknown>(null),
          fc.array(fc.integer()),
          fc.record({ totalEntries: fc.integer(), winRate: fc.constant(null) }),
        ),
        (fallback) => {
          const result = safeQuery(fallback, () => {
            throw new Error("tournament_results missing (simulated)");
          });
          // 例外を飲み込み、渡した fallback をそのまま返す。
          expect(result).toBe(fallback);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: data-tab, Property 14: 閲覧専用（副作用非発生）
  // Validates: Requirements 11.1, 11.2
  it("Property 14: 取得系 SELECT の呼び出し前後で users/teams/team_members の件数と内容が不変", () => {
    fc.assert(
      fc.property(
        // 少数のユーザー（うち一部は未査定）とチーム構成を生成する。
        fc.array(
          fc.record({
            granLevel: fc.integer({ min: 100, max: 999 }),
            isCalibrated: fc.constantFrom<0 | 1>(0, 1),
            ratedMatchCount: fc.integer({ min: 0, max: 300 }),
          }),
          { minLength: 0, maxLength: 6 },
        ),
        // チームを作るか（作る場合は先頭ユーザーを代表に、全員をメンバーに）。
        fc.boolean(),
        // tier フィルタ対象（階級内ランキング呼び出し用）。
        fc.constantFrom(...ALL_TIERS),
        (userSpecs, makeTeam, tier) => {
          // このプロパティ試行用のユニーク接尾辞。
          const runId = `${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
          const baseTs = "2024-01-01 00:00:00";

          try {
            const userIds: string[] = [];
            userSpecs.forEach((spec, i) => {
              const id = `${PREFIX}${runId}-u${i}`;
              userIds.push(id);
              insertUser({
                id,
                loginId: `${PREFIX}${runId}-login${i}`,
                email: `${PREFIX}${runId}-u${i}@example.test`,
                nickname: `nick-${i}`,
                granLevel: spec.granLevel,
                isCalibrated: spec.isCalibrated,
                ratedMatchCount: spec.ratedMatchCount,
                createdAt: baseTs,
              });
            });

            if (makeTeam && userIds.length > 0) {
              const teamId = `${PREFIX}${runId}-team`;
              insertTeam({
                id: teamId,
                name: `team-${runId}`,
                leaderUserId: userIds[0],
                createdAt: baseTs,
              });
              userIds.forEach((uid, i) => {
                insertTeamMember({
                  id: `${PREFIX}${runId}-tm${i}`,
                  teamId,
                  userId: uid,
                  joinedAt: baseTs,
                });
              });
            }

            // 呼び出し前スナップショット。
            const before = SNAPSHOT_TABLES.map((t) => snapshotTable(t));

            // 全ての取得系関数を呼び出す（SELECT のみ想定）。
            listPersonalRanking();
            listTierRanking(tier);
            listTeamRatingRows();
            listCalibratedLevels();
            countUncalibratedUsers();
            // tournament_results 非存在のためフォールバック経路を通る。
            for (const uid of userIds) {
              getLevelHistory(uid);
              listEntryHistory(uid);
              getPerformanceSummary(uid);
            }
            // 存在しない userId でも呼ぶ。
            getLevelHistory(`${PREFIX}${runId}-missing`);
            listEntryHistory(`${PREFIX}${runId}-missing`);
            getPerformanceSummary(`${PREFIX}${runId}-missing`);

            // 呼び出し後スナップショット。
            const after = SNAPSHOT_TABLES.map((t) => snapshotTable(t));

            // 件数・内容ともに不変であること。
            SNAPSHOT_TABLES.forEach((_t, idx) => {
              expect(after[idx].count).toBe(before[idx].count);
              expect(after[idx].content).toBe(before[idx].content);
            });
          } finally {
            // この試行で挿入した行を確実に削除する（分離のため）。
            cleanupInserted();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
