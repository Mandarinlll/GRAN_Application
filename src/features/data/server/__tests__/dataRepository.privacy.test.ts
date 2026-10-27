// データタブ（GRAN_Data_Tab）: 非公開プロフィール項目の非露出プロパティテスト。
//
// listPersonalRanking / listTierRanking / listTeamRatingRows の戻り値（ビューモデル）に、
// 本名・フリガナ・電話番号・メール・生年月日・個人エントリー者本名の
// いずれの非公開項目も現れないことを検証する。
//
// 各ユーザーには識別しやすいセンチネル値（例: SECRET_REALNAME）を書き込み、
//   (1) 戻り値を JSON 文字列化してセンチネルが一切含まれないこと、
//   (2) 戻り値オブジェクトに非公開項目のキー（realName / kana_name など）が存在しないこと
// の両面から確認する。
//
// 重要 — テスト分離:
//   リポジトリ（dataRepository.ts）は @/lib/db の共有シングルトン db を import する。
//   db は本番と同じ永続ファイル（data/gran.db, WAL モード）を指すため、テストから
//   直接書き込むと開発用 DB を破壊しうる（実際に破損が発生した）。
//   そこで @/lib/db が参照する globalThis.__granDb に「使い捨ての in-memory DB」を
//   事前注入し、リポジトリを動的 import してその分離 DB に束縛する。
//   これにより data/gran.db には一切触れない。

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fc from "fast-check";
import { DatabaseSync } from "node:sqlite";

import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type {
  RankableUser,
  TeamRatingRow,
} from "@/features/data/types/data";

// 非公開項目のセンチネル値。これらは公開ビューモデルに決して現れてはならない。
const SECRET_REAL_NAME = "SECRET_REALNAME";
const SECRET_KANA_NAME = "SECRET_KANA";
const SECRET_PHONE = "090SECRET";
const SECRET_BIRTH_DATE = "1990-01-01";
// メールは UNIQUE 制約があるため、ユーザーごとに一意化した上で共通サフィックスで検出する。
const SECRET_EMAIL_SUFFIX = "@secret.example.invalid";

const PRIVATE_SENTINELS = [
  SECRET_REAL_NAME,
  SECRET_KANA_NAME,
  SECRET_PHONE,
  SECRET_BIRTH_DATE,
  SECRET_EMAIL_SUFFIX,
];

// 公開ビューモデルに存在してはならない非公開項目キー（camelCase / snake_case 双方）。
const FORBIDDEN_KEYS = [
  "realName",
  "real_name",
  "kanaName",
  "kana_name",
  "phoneNumber",
  "phone_number",
  "email",
  "birthDate",
  "birth_date",
  "passwordHash",
  "password_hash",
];

// 8 段階の規定階級（listTierRanking の引数に使用）。
const TIERS: TournamentTier[] = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];

// ---------------------------------------------------------------------------
// 分離 DB の準備: @/lib/db が読む globalThis.__granDb に in-memory DB を注入する。
// リポジトリは beforeAll 内で動的 import し、この注入済み DB に束縛する。
// ---------------------------------------------------------------------------

// db-schema.md / src/lib/db.ts と同等の、本テストに必要なテーブルのみを定義する。
function createSchema(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE users (
      id                    TEXT    PRIMARY KEY,
      login_id              TEXT    NOT NULL UNIQUE,
      email                 TEXT    NOT NULL UNIQUE,
      password_hash         TEXT    NOT NULL,
      role                  TEXT    NOT NULL DEFAULT 'USER',
      is_admin              INTEGER NOT NULL DEFAULT 0,
      status                TEXT    NOT NULL DEFAULT 'ACTIVE',
      is_initial_login      INTEGER NOT NULL DEFAULT 0,
      real_name             TEXT    NOT NULL,
      kana_name             TEXT    NOT NULL,
      nickname              TEXT    NOT NULL,
      avatar_url            TEXT,
      gender                TEXT,
      birth_date            TEXT,
      phone_number          TEXT,
      declared_class        TEXT,
      gran_level            INTEGER NOT NULL DEFAULT 100,
      is_level_calibrated   INTEGER NOT NULL DEFAULT 0,
      rated_match_count     INTEGER NOT NULL DEFAULT 0,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until          TEXT,
      last_login_at         TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE teams (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      avatar_url     TEXT,
      leader_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE team_members (
      id        TEXT PRIMARY KEY,
      team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (team_id, user_id)
    );
  `);
}

// 分離 DB と、それに束縛されたリポジトリ関数を保持する。
let testDb: DatabaseSync;
let listPersonalRanking: () => RankableUser[];
let listTierRanking: (tier: TournamentTier) => RankableUser[];
let listTeamRatingRows: () => TeamRatingRow[];

beforeAll(async () => {
  // in-memory の使い捨て DB を用意し、@/lib/db が再利用するグローバルへ注入する。
  testDb = new DatabaseSync(":memory:");
  createSchema(testDb);
  (globalThis as { __granDb?: DatabaseSync }).__granDb = testDb;

  // 注入後に動的 import することで、リポジトリは testDb に束縛される。
  const repo = await import("@/features/data/server/dataRepository");
  listPersonalRanking = repo.listPersonalRanking;
  listTierRanking = repo.listTierRanking;
  listTeamRatingRows = repo.listTeamRatingRows;
});

// シード用ユーザーの生成仕様。
interface SeedUserSpec {
  granLevel: number;
  isCalibrated: boolean;
  ratedMatchCount: number;
}

const seedUserArb: fc.Arbitrary<SeedUserSpec> = fc.record({
  granLevel: fc.integer({ min: 100, max: 999 }),
  isCalibrated: fc.boolean(),
  ratedMatchCount: fc.integer({ min: 0, max: 300 }),
});

// 分離 DB を空にする（run ごとの独立性を担保）。子→親の順で削除する。
function cleanAll(): void {
  testDb.exec("DELETE FROM team_members;");
  testDb.exec("DELETE FROM teams;");
  testDb.exec("DELETE FROM users;");
}

// センチネル値付きのユーザーを 1 件挿入し、その id を返す。
function insertSeedUser(index: number, spec: SeedUserSpec): string {
  const id = `user-${index}`;
  testDb
    .prepare(
      `INSERT INTO users (
         id, login_id, email, password_hash, role, is_admin, status,
         is_initial_login, real_name, kana_name, nickname, avatar_url,
         gender, birth_date, phone_number, declared_class,
         gran_level, is_level_calibrated, rated_match_count
       ) VALUES (?, ?, ?, ?, 'USER', 0, 'ACTIVE', 0, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)`,
    )
    .run(
      id,
      `login-${index}`,
      // UNIQUE を満たしつつ共通サフィックスでセンチネル検出可能にする。
      `user${index}${SECRET_EMAIL_SUFFIX}`,
      "hash-irrelevant",
      SECRET_REAL_NAME,
      SECRET_KANA_NAME,
      // nickname は公開項目。センチネルは含めない。
      `ニックネーム${index}`,
      // avatar_url（? プレースホルダに対応）。
      null,
      SECRET_BIRTH_DATE,
      SECRET_PHONE,
      spec.granLevel,
      spec.isCalibrated ? 1 : 0,
      spec.ratedMatchCount,
    );
  return id;
}

// チームとメンバー構成を 1 件挿入する。leader はメンバーにも含める。
function insertSeedTeam(
  index: number,
  leaderUserId: string,
  memberUserIds: string[],
): void {
  const teamId = `team-${index}`;
  testDb
    .prepare(
      `INSERT INTO teams (id, name, avatar_url, leader_user_id)
         VALUES (?, ?, NULL, ?)`,
    )
    .run(teamId, `チーム${index}`, leaderUserId);

  const uniqueMembers = Array.from(new Set([leaderUserId, ...memberUserIds]));
  uniqueMembers.forEach((userId, memberIndex) => {
    testDb
      .prepare(
        `INSERT INTO team_members (id, team_id, user_id)
           VALUES (?, ?, ?)`,
      )
      .run(`tm-${index}-${memberIndex}`, teamId, userId);
  });
}

// 任意の戻り値（配列 / オブジェクト）に非公開センチネル値が含まれないことを検証する。
function expectNoPrivateSentinels(label: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const sentinel of PRIVATE_SENTINELS) {
    expect(
      serialized.includes(sentinel),
      `${label} が非公開センチネル "${sentinel}" を含んでいます`,
    ).toBe(false);
  }
}

// 戻り値の各オブジェクトに禁止キーが存在しないことを（ネストも含め）検証する。
function expectNoForbiddenKeys(label: string, rows: unknown[]): void {
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      expect(
        FORBIDDEN_KEYS.includes(key),
        `${label} が非公開キー "${key}" を含んでいます`,
      ).toBe(false);
      visit((node as Record<string, unknown>)[key]);
    }
  };
  visit(rows);
}

describe("dataRepository privacy", () => {
  beforeEach(() => {
    cleanAll();
  });

  // Feature: data-tab, Property 10: 非公開プロフィール項目の非露出
  // Validates: Requirements 2.2, 2.3, 8.2, 8.4
  it("Property 10: listPersonalRanking / listTierRanking / listTeamRatingRows の戻り値に本名・フリガナ・電話番号・メール・生年月日・個人エントリー者本名を一切含めない", () => {
    fc.assert(
      fc.property(
        fc.array(seedUserArb, { minLength: 1, maxLength: 12 }),
        (specs) => {
          // 各 run はクリーンな状態から開始する（beforeEach はプロパティ本体の外で
          // 一度しか動かないため、run ごとに明示的にクリーンアップ・再シードする）。
          cleanAll();

          const userIds = specs.map((spec, index) =>
            insertSeedUser(index, spec),
          );

          // 先頭ユーザーをリーダーとするチームを 1 件作り、全ユーザーを所属させる。
          // これにより listTeamRatingRows も非空の母集団で検証できる。
          insertSeedTeam(0, userIds[0], userIds);

          // 1) 個人ランキング（全体）。
          const personal = listPersonalRanking();
          expectNoPrivateSentinels("listPersonalRanking", personal);
          expectNoForbiddenKeys("listPersonalRanking", personal);

          // 2) 階級内ランキング（全 8 階級）。
          for (const tier of TIERS) {
            const tierRows = listTierRanking(tier);
            expectNoPrivateSentinels(`listTierRanking(${tier})`, tierRows);
            expectNoForbiddenKeys(`listTierRanking(${tier})`, tierRows);
          }

          // 3) チームランキング素材。
          const teams = listTeamRatingRows();
          expectNoPrivateSentinels("listTeamRatingRows", teams);
          expectNoForbiddenKeys("listTeamRatingRows", teams);
        },
      ),
      { numRuns: 100 },
    );
  });
});
