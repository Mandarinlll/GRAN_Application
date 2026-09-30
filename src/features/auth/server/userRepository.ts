// users テーブルへのアクセスを集約するリポジトリ。
// SQL はこの層にのみ閉じ込め、上位（Server Actions）はドメイン関数として呼ぶ。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type {
  DeclaredClass,
  Gender,
  User,
  UserRole,
} from "@/types/user";

// アカウントロック仕様（requirements-detail-user.md 1.4）。
const MAX_FAILED_ATTEMPTS = 10;

// DB の生の行（snake_case / INTEGER 真偽値）の形。
interface UserRow {
  id: string;
  login_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_admin: number;
  status: User["status"];
  is_initial_login: number;
  real_name: string;
  kana_name: string;
  nickname: string;
  avatar_url: string | null;
  gender: Gender | null;
  birth_date: string | null;
  phone_number: string | null;
  declared_class: DeclaredClass | null;
  gran_level: number;
  is_level_calibrated: number;
  rated_match_count: number;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// DB 行 → アプリ内部の User 型へ変換する（password_hash は除外）。
function toUser(row: UserRow): User {
  return {
    id: row.id,
    loginId: row.login_id,
    email: row.email,
    role: row.role,
    isAdmin: row.is_admin === 1,
    status: row.status,
    isInitialLogin: row.is_initial_login === 1,
    realName: row.real_name,
    kanaName: row.kana_name,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    gender: row.gender,
    birthDate: row.birth_date,
    phoneNumber: row.phone_number,
    declaredClass: row.declared_class,
    granLevel: row.gran_level,
    isLevelCalibrated: row.is_level_calibrated === 1,
    ratedMatchCount: row.rated_match_count,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// メールアドレスが既に登録済みか判定する。
export function emailExists(email: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1")
    .get(email.toLowerCase());
  return row !== undefined;
}

// 次に採番する login_id（6桁ゼロ埋め）を決定する。
// 一般ユーザー・代表者は 000101 以上（requirements-detail-user.md 1.1）。
function nextLoginId(): string {
  const START = 101; // 000101 から採番
  const row = db
    .prepare(
      "SELECT MAX(CAST(login_id AS INTEGER)) AS maxId FROM users WHERE CAST(login_id AS INTEGER) >= ?",
    )
    .get(START) as { maxId: number | null };
  const next = (row.maxId ?? START - 1) + 1;
  return String(next).padStart(6, "0");
}

// 新規ユーザー作成に必要な入力。
export interface CreateUserParams {
  email: string;
  passwordHash: string;
  realName: string;
  kanaName: string;
  nickname: string;
  gender: Gender;
  birthDate: string;
  phoneNumber: string | null;
  declaredClass: DeclaredClass;
  granLevel: number;
}

// ユーザーを新規作成して作成後の User を返す。
export function createUser(params: CreateUserParams): User {
  const id = randomUUID();
  const loginId = nextLoginId();

  db.prepare(
    `INSERT INTO users (
      id, login_id, email, password_hash, role, is_admin, status,
      is_initial_login, real_name, kana_name, nickname, gender, birth_date,
      phone_number, declared_class, gran_level, is_level_calibrated, rated_match_count
    ) VALUES (?, ?, ?, ?, 'USER', 0, 'ACTIVE', 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
  ).run(
    id,
    loginId,
    params.email.toLowerCase(),
    params.passwordHash,
    params.realName,
    params.kanaName,
    params.nickname,
    params.gender,
    params.birthDate,
    params.phoneNumber,
    params.declaredClass,
    params.granLevel,
  );

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  return toUser(row);
}

// 認証用に password_hash 込みで1件取得する（ログインID または メール）。
export function findRowByIdentifier(identifier: string): UserRow | undefined {
  const value = identifier.trim();
  return db
    .prepare(
      "SELECT * FROM users WHERE login_id = ? OR email = ? LIMIT 1",
    )
    .get(value, value.toLowerCase()) as UserRow | undefined;
}

// id から User を1件取得する（セッション復元用、password_hash は返さない）。
export function findUserById(id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  return row ? toUser(row) : null;
}

// ログイン失敗を記録し、上限到達でロックする。
export function registerFailedLogin(id: string): void {
  const row = db
    .prepare("SELECT failed_login_attempts FROM users WHERE id = ?")
    .get(id) as { failed_login_attempts: number } | undefined;
  if (!row) return;

  const attempts = row.failed_login_attempts + 1;
  // 上限到達時は locked_until に十分先の日時を入れて事実上の永久ロックとする。
  const lockedUntil =
    attempts >= MAX_FAILED_ATTEMPTS ? "9999-12-31 23:59:59" : null;

  db.prepare(
    `UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ${NOW_JST} WHERE id = ?`,
  ).run(attempts, lockedUntil, id);
}

// ログイン成功時に失敗カウントをリセットし最終ログイン日時を更新する。
export function registerSuccessfulLogin(id: string): void {
  db.prepare(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ${NOW_JST}, updated_at = ${NOW_JST} WHERE id = ?`,
  ).run(id);
}

// ロック中か判定する（locked_until が未来なら true）。
export function isLocked(row: UserRow): boolean {
  if (!row.locked_until) return false;
  return new Date(row.locked_until.replace(" ", "T")) > new Date();
}

// UserRow → User の公開変換（Server Actions から利用）。
export function rowToUser(row: UserRow): User {
  return toUser(row);
}

export type { UserRow };
