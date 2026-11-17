// 管理コンソール動作確認用のテストアカウント（管理者 / 運営者）を投入するスクリプト。
//
// 実行:
//   npm run seed:admin
//
// 投入内容（開発用。本番DBでは絶対に実行しないこと）:
//   ADMIN    : ログインID 000001 / admin@example.test    / password123
//   OPERATOR : ログインID 000002 / operator@example.test / password123
//
// 冪等性: ログインIDが既にあれば新規作成せず、role / is_admin / status のみ期待値へ戻す。
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, NOW_JST } from "../src/lib/db.ts";

const PASSWORD = "password123";

const ACCOUNTS = [
  {
    loginId: "000001",
    email: "admin@example.test",
    role: "ADMIN",
    realName: "管理者 テスト",
    kanaName: "カンリシャ テスト",
    nickname: "テスト管理者",
  },
  {
    loginId: "000002",
    email: "operator@example.test",
    role: "OPERATOR",
    realName: "運営者 テスト",
    kanaName: "ウンエイシャ テスト",
    nickname: "テスト運営者",
  },
] as const;

// is_admin は既存コードで「全権限の上書き」として扱われるため ADMIN のみ 1 にする。
// OPERATOR は role だけで管理コンソールに入れる（最小権限）。
function isAdminFlag(role: string): number {
  return role === "ADMIN" ? 1 : 0;
}

const hash = await bcrypt.hash(PASSWORD, 10);

for (const a of ACCOUNTS) {
  const existing = db
    .prepare("SELECT id FROM users WHERE login_id = ? OR email = ?")
    .get(a.loginId, a.email) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE users SET role = ?, is_admin = ?, status = 'ACTIVE', updated_at = ${NOW_JST} WHERE id = ?`,
    ).run(a.role, isAdminFlag(a.role), existing.id);
    console.log(`[seed-admin] 既存のため権限のみ更新: ${a.loginId} (${a.role})`);
    continue;
  }

  db.prepare(
    `INSERT INTO users (
      id, login_id, email, password_hash, role, is_admin, status,
      is_initial_login, real_name, kana_name, nickname, gender, birth_date,
      phone_number, declared_class, gran_level, is_level_calibrated, rated_match_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?, ?, 'OTHER', '1990-01-01', NULL, 'C', 500, 1, 0, ${NOW_JST}, ${NOW_JST})`,
  ).run(randomUUID(), a.loginId, a.email, hash, a.role, isAdminFlag(a.role), a.realName, a.kanaName, a.nickname);
  console.log(`[seed-admin] 作成: ${a.loginId} / ${a.email} (${a.role}) パスワード: ${PASSWORD}`);
}
