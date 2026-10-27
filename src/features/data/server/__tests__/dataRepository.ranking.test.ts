// データタブ（GRAN_Data_Tab）リポジトリのランキング系プロパティテスト。
//
// シード済みの共有 SQLite（@/lib/db の DatabaseSync, data/gran.db）に対して、
// 各 fast-check 反復で users / teams / team_members をクリーンアップし、
// 生成行を挿入してからリポジトリ関数を呼び、戻り値の性質を検証する。
//
// 1 プロパティ = 1 テスト、各 numRuns: 100。
//
// Validates: Requirements 2.10, 3.7, 7.8, 3.2, 3.3, 4.1, 4.5, 4.6, 4.7

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";

import { db } from "@/lib/db";
import { granLevelToTier } from "@/features/auth/utils/classLabel";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import {
  listPersonalRanking,
  listTierRanking,
  listCalibratedLevels,
  listTeamRatingRows,
} from "@/features/data/server/dataRepository";

// ---------------------------------------------------------------------------
// シード用ヘルパ
// ---------------------------------------------------------------------------

// テストで生成する 1 ユーザーの素材。
interface GenUser {
  granLevel: number;
  isCalibrated: boolean;
  ratedMatchCount: number;
}

// テストで生成する 1 チームの素材（リーダー + メンバーの gran_level 群）。
interface GenTeam {
  leaderLevel: number;
  // チームに属するメンバー（リーダー以外）の gran_level 群。
  memberLevels: number[];
}

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

// 依存テーブルを空にする。
// users は entries / waitlists / notification_logs など多数のテーブルから参照され得るため、
// users を参照しうる全テーブルを子→親の順で削除する。既存シードデータの残骸で FK 制約に
// 引っかからないよう、クリーンアップ中のみ FK 強制を一時的に無効化する（テスト専用の初期化）。
function cleanTables(): void {
  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("DELETE FROM cancellations;");
  db.exec("DELETE FROM waitlists;");
  db.exec("DELETE FROM entry_members;");
  db.exec("DELETE FROM entries;");
  db.exec("DELETE FROM notification_logs;");
  db.exec("DELETE FROM team_members;");
  db.exec("DELETE FROM teams;");
  db.exec("DELETE FROM users;");
  db.exec("PRAGMA foreign_keys = ON;");
}

let userSeq = 0;

// NOT NULL 制約を満たす最小限のユーザー行を挿入し、生成した id を返す。
// gran_level / is_level_calibrated / rated_match_count のみ可変で、
// 本名・フリガナ等の非公開項目はプレースホルダーで埋める。
function insertUser(
  granLevel: number,
  isCalibrated: boolean,
  ratedMatchCount: number,
  createdAt: string,
): string {
  userSeq += 1;
  const id = `u-${userSeq}`;
  db.prepare(
    `INSERT INTO users (
       id, login_id, email, password_hash, role,
       real_name, kana_name, nickname,
       gran_level, is_level_calibrated, rated_match_count, created_at
     ) VALUES (?, ?, ?, ?, 'USER', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    `login-${userSeq}`,
    `user-${userSeq}@example.test`,
    "x".repeat(16),
    `RealName${userSeq}`,
    `カナ${userSeq}`,
    `nick-${userSeq}`,
    granLevel,
    isCalibrated ? 1 : 0,
    ratedMatchCount,
    createdAt,
  );
  return id;
}

let teamSeq = 0;

// リーダー + メンバーからチームを作成する。
// リーダーもチームの一員として team_members に含める（集計対象）。
function insertTeam(leaderUserId: string, memberUserIds: string[]): void {
  teamSeq += 1;
  const teamId = `t-${teamSeq}`;
  db.prepare(
    `INSERT INTO teams (id, name, leader_user_id) VALUES (?, ?, ?)`,
  ).run(teamId, `team-${teamSeq}`, leaderUserId);

  const allMemberIds = [leaderUserId, ...memberUserIds];
  for (const uid of allMemberIds) {
    teamSeq += 1;
    db.prepare(
      `INSERT INTO team_members (id, team_id, user_id) VALUES (?, ?, ?)`,
    ).run(`tm-${teamSeq}`, teamId, uid);
  }
}

// gran_level は 100〜999 で保存できる値のみ（CHECK 制約）。
// is_level_calibrated は boolean、rated_match_count は 0 以上。
const userArb: fc.Arbitrary<GenUser> = fc.record({
  granLevel: fc.integer({ min: 100, max: 999 }),
  isCalibrated: fc.boolean(),
  ratedMatchCount: fc.integer({ min: 0, max: 500 }),
});

const userSetArb = fc.array(userArb, { minLength: 0, maxLength: 30 });

// ---------------------------------------------------------------------------
// 各テスト前後でテーブルを初期化し、テスト完了後も残骸を残さない。
// ---------------------------------------------------------------------------

beforeEach(() => {
  cleanTables();
});

afterAll(() => {
  cleanTables();
});

// ===========================================================================
// Feature: data-tab, Property 2: 未査定ユーザーの母集団除外
//
// 査定済・未査定が混在するユーザー集合に対し、個人ランキング・階級内ランキング・
// レベル分布の母集団（listPersonalRanking / listTierRanking / listCalibratedLevels）
// には is_level_calibrated = 0 のユーザーが一切含まれない。
//
// Validates: Requirements 2.10, 3.7, 7.8
// ===========================================================================
describe("Property 2: 未査定ユーザーの母集団除外", () => {
  it("listPersonalRanking / listTierRanking / listCalibratedLevels は未査定ユーザーを含めない", () => {
    fc.assert(
      fc.property(userSetArb, (users) => {
        cleanTables();

        // 挿入した id と、その査定状態を記録する。
        const calibratedIds = new Set<string>();
        const uncalibratedIds = new Set<string>();
        users.forEach((u, i) => {
          const id = insertUser(
            u.granLevel,
            u.isCalibrated,
            u.ratedMatchCount,
            `2024-01-01T00:00:${String(i % 60).padStart(2, "0")}+09:00`,
          );
          if (u.isCalibrated) calibratedIds.add(id);
          else uncalibratedIds.add(id);
        });

        // 個人ランキング: 未査定 id が一切含まれない。
        const personal = listPersonalRanking();
        for (const row of personal) {
          expect(uncalibratedIds.has(row.id)).toBe(false);
          expect(calibratedIds.has(row.id)).toBe(true);
        }
        // 査定済ユーザー数と一致する（全員 100〜999 の有効レンジ）。
        expect(personal.length).toBe(calibratedIds.size);

        // 階級内ランキング: 全 tier を合算しても未査定は含まれない。
        for (const tier of ALL_TIERS) {
          const tierRows = listTierRanking(tier);
          for (const row of tierRows) {
            expect(uncalibratedIds.has(row.id)).toBe(false);
          }
        }

        // レベル分布素材: 件数は査定済ユーザー数と一致する。
        const levels = listCalibratedLevels();
        expect(levels.length).toBe(calibratedIds.size);
      }),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Feature: data-tab, Property 3: 階級フィルタ結果の健全性
//
// 任意のユーザー集合と任意の規定階級 tier に対し、listTierRanking(tier) の
// 全要素は granLevelToTier(granLevel) === tier を満たし、かつ gran_level 降順で並ぶ。
//
// Validates: Requirements 3.2, 3.3, 4.1, 4.5, 4.6
// ===========================================================================
describe("Property 3: 階級フィルタ結果の健全性", () => {
  it("listTierRanking(tier) の全行は tier に属し、gran_level 降順で並ぶ", () => {
    fc.assert(
      fc.property(
        userSetArb,
        fc.constantFrom(...ALL_TIERS),
        (users, tier) => {
          cleanTables();

          users.forEach((u, i) => {
            insertUser(
              u.granLevel,
              u.isCalibrated,
              u.ratedMatchCount,
              `2024-01-01T00:00:${String(i % 60).padStart(2, "0")}+09:00`,
            );
          });

          const rows = listTierRanking(tier);

          // (a) 全行が指定 tier に属する。
          for (const row of rows) {
            expect(granLevelToTier(row.granLevel)).toBe(tier);
          }

          // (b) gran_level は降順（非増加）に並ぶ。
          for (let i = 1; i < rows.length; i += 1) {
            expect(rows[i - 1].granLevel).toBeGreaterThanOrEqual(
              rows[i].granLevel,
            );
          }

          // (c) 未査定は含まれない（母集団は査定済のみ）。
          //     行数は「査定済 かつ 当該 tier」のユーザー数と一致する。
          const expectedCount = users.filter(
            (u) => u.isCalibrated && granLevelToTier(u.granLevel) === tier,
          ).length;
          expect(rows.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Feature: data-tab, Property 6: チームランキングの順序と有効メンバー要件
//
// チーム順序・順位付与はビューモデル層（dataViewData）で行うため、リポジトリ層では
// listTeamRatingRows が返す memberLevels が有効 gran_level（100〜999）メンバーのみを
// 含み、かつ有効メンバー 0 名のチームは memberLevels が空配列になることを検証する。
//
// ※ users.gran_level は CHECK 制約で 100〜999 に限定されるため「範囲外メンバー」は
//   DB に挿入できない。そこで「有効メンバー 0 名」は team_members を持たないチームで表現する。
//
// Validates: Requirements 4.1, 4.5, 4.6, 4.7
// ===========================================================================
const teamArb: fc.Arbitrary<GenTeam> = fc.record({
  leaderLevel: fc.integer({ min: 100, max: 999 }),
  memberLevels: fc.array(fc.integer({ min: 100, max: 999 }), {
    minLength: 0,
    maxLength: 6,
  }),
});

// 有効メンバー 0 名のチーム（メンバー無し）か、メンバーを持つチームかを混在させる。
const teamSetArb = fc.array(
  fc.record({
    team: teamArb,
    // true のときはリーダーのみ登録し team_members を一切作らない（有効メンバー 0 名）。
    empty: fc.boolean(),
  }),
  { minLength: 0, maxLength: 10 },
);

describe("Property 6: チームランキングの順序と有効メンバー要件", () => {
  it("listTeamRatingRows の memberLevels は有効レベルのみを含み、メンバー不在チームは空配列を返す", () => {
    fc.assert(
      fc.property(teamSetArb, (teamSpecs) => {
        cleanTables();

        // 各チームごとに、期待される有効メンバーレベルの multiset を記録する。
        const expectedByTeamName = new Map<string, number[]>();

        teamSpecs.forEach((spec, i) => {
          const leaderId = insertUser(
            spec.team.leaderLevel,
            true,
            0,
            `2024-02-01T00:00:${String(i % 60).padStart(2, "0")}+09:00`,
          );

          if (spec.empty) {
            // リーダーのみ存在し team_members を作らない → 有効メンバー 0 名。
            db.prepare(
              `INSERT INTO teams (id, name, leader_user_id) VALUES (?, ?, ?)`,
            ).run(`t-empty-${i}`, `empty-team-${i}`, leaderId);
            expectedByTeamName.set(`empty-team-${i}`, []);
            return;
          }

          const memberIds = spec.team.memberLevels.map((lvl, j) =>
            insertUser(
              lvl,
              true,
              0,
              `2024-03-01T00:00:${String(j % 60).padStart(2, "0")}+09:00`,
            ),
          );
          insertTeam(leaderId, memberIds);
          // insertTeam はリーダーも team_members に含める。
          const expectedLevels = [
            spec.team.leaderLevel,
            ...spec.team.memberLevels,
          ];
          // insertTeam が付与するチーム名は `team-${teamSeq}` だが teamSeq は
          // 可変なので、戻り値から特定できるよう別名で再構築せず、ここでは
          // 「全行の memberLevels を合算した multiset」で検証する（下記参照）。
          expectedByTeamName.set(leaderId, expectedLevels);
        });

        const rows = listTeamRatingRows();

        // (a) すべての行の memberLevels は有効 gran_level（100〜999）のみ。
        for (const row of rows) {
          for (const lvl of row.memberLevels) {
            expect(lvl).toBeGreaterThanOrEqual(100);
            expect(lvl).toBeLessThanOrEqual(999);
          }
        }

        // (b) メンバー不在チーム（empty）は memberLevels が空配列。
        const emptyTeamNames = teamSpecs
          .map((spec, i) => (spec.empty ? `empty-team-${i}` : null))
          .filter((n): n is string => n !== null);
        for (const name of emptyTeamNames) {
          const row = rows.find((r) => r.name === name);
          expect(row).toBeDefined();
          expect(row?.memberLevels).toEqual([]);
        }

        // (c) 全チーム（空含む）が 1 行ずつ返る。
        expect(rows.length).toBe(teamSpecs.length);

        // (d) メンバーを持つチームの memberLevels 合算 multiset が、挿入した
        //     有効レベルの合算 multiset と一致する（取りこぼし / 余分が無い）。
        const expectedAllLevels: number[] = [];
        teamSpecs.forEach((spec) => {
          if (spec.empty) return;
          expectedAllLevels.push(
            spec.team.leaderLevel,
            ...spec.team.memberLevels,
          );
        });
        const actualAllLevels = rows.flatMap((r) => r.memberLevels);
        expect(sortedCopy(actualAllLevels)).toEqual(
          sortedCopy(expectedAllLevels),
        );
      }),
      { numRuns: 100 },
    );
  });
});

// 数値配列を昇順ソートした新しい配列を返す（multiset 比較用）。
function sortedCopy(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}
