// ユーザー管理用の SQL（users の SELECT / INSERT / UPDATE / DELETE と判定クエリ）。
// - WHERE は固定の断片のみ。値は必ずバインド変数。入力文字列を SQL に連結しない。
// - password_hash は SELECT しない。
// - トランザクション境界は呼び出し側（サービスの runInTransaction）が持つ。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type {
  CreateUserInput,
  UserDetail,
  UserListRow,
  UserTeamSummary,
} from "@/features/accounts/types/account";
import { listLogsForTarget } from "@/features/accounts/server/adminLogRepository";
import { calibrationMidpoint } from "@/features/accounts/utils/calibration";
import { LOCKED_SQL } from "@/features/accounts/utils/lockState";
import { PAGE_SIZE, type UserListQuery } from "@/features/accounts/utils/listQuery";
import type { AccountStatus, DeclaredClass, Gender, UserRole } from "@/types/user";

export const LOGIN_ID_START = 101;
export const LOGIN_ID_MAX = 999999;

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

interface ListRowRaw {
  id: string;
  login_id: string;
  real_name: string;
  nickname: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  gran_level: number;
  declared_class: DeclaredClass | null;
  locked: number;
  is_level_calibrated: number;
}

export interface UserListPage {
  rows: UserListRow[];
  total: number;
  /** 範囲外のページは最終ページに丸めた後の値。 */
  page: number;
}

function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => "\\" + c);
}

export function listUsers(query: UserListQuery): UserListPage {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.q) {
    const like = `%${escapeLike(query.q)}%`;
    where.push(
      `(u.real_name LIKE ? ESCAPE '\\' OR u.kana_name LIKE ? ESCAPE '\\' OR u.nickname LIKE ? ESCAPE '\\'
        OR u.email LIKE ? ESCAPE '\\' OR u.login_id LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like);
  }
  if (query.role) {
    where.push("u.role = ?");
    params.push(query.role);
  }
  if (query.status) {
    where.push("u.status = ?");
    params.push(query.status);
  }
  if (query.declaredClass) {
    where.push("u.declared_class = ?");
    params.push(query.declaredClass);
  }
  if (query.lockedOnly) where.push(LOCKED_SQL);
  if (query.uncalibratedOnly) where.push("u.is_level_calibrated = 0");

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql = query.uncalibratedOnly
    ? "ORDER BY u.created_at ASC, u.id ASC"
    : "ORDER BY u.login_id ASC, u.id ASC";

  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM users u ${whereSql}`)
    .get(...params) as { n: number };
  const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(query.page)), pages);

  const raw = db
    .prepare(
      `SELECT u.id, u.login_id, u.real_name, u.nickname, u.email, u.role, u.status,
              u.gran_level, u.declared_class, u.is_level_calibrated,
              CASE WHEN ${LOCKED_SQL} THEN 1 ELSE 0 END AS locked
         FROM users u
         ${whereSql}
         ${orderSql}
         LIMIT ? OFFSET ?`,
    )
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as unknown as ListRowRaw[];

  return {
    total: n,
    page,
    rows: raw.map((r) => ({
      id: r.id,
      loginId: r.login_id,
      realName: r.real_name,
      nickname: r.nickname,
      email: r.email,
      role: r.role,
      status: r.status,
      granLevel: r.gran_level,
      declaredClass: r.declared_class,
      locked: r.locked === 1,
      isLevelCalibrated: r.is_level_calibrated === 1,
    })),
  };
}

// ---------------------------------------------------------------------------
// 詳細
// ---------------------------------------------------------------------------

interface DetailRowRaw {
  id: string;
  login_id: string;
  real_name: string;
  kana_name: string | null;
  nickname: string;
  email: string;
  gender: Gender | null;
  birth_date: string | null;
  phone_number: string | null;
  role: UserRole;
  status: AccountStatus;
  gran_level: number;
  declared_class: DeclaredClass | null;
  is_level_calibrated: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  locked: number;
}

// Active_Personal_Entry の定義: CONFIRMED / WAITING かつ本人が申込者またはメンバー。
const ACTIVE_PERSONAL_ENTRY_SQL = `
  FROM entries e
 WHERE e.status IN ('CONFIRMED','WAITING')
   AND (e.user_id = ? OR EXISTS (
         SELECT 1 FROM entry_members m WHERE m.entry_id = e.id AND m.user_id = ?))`;

/** エントリー ID の重複なしで数える。 */
export function countActivePersonalEntries(userId: string): number {
  const row = db
    .prepare(`SELECT COUNT(DISTINCT e.id) AS n ${ACTIVE_PERSONAL_ENTRY_SQL}`)
    .get(userId, userId) as { n: number };
  return row.n;
}

export function hasActivePersonalEntry(userId: string): boolean {
  return countActivePersonalEntries(userId) > 0;
}

interface TeamRaw {
  id: string;
  name: string;
  leader_nickname: string;
  is_leader: number;
}

function listUserTeams(userId: string): UserTeamSummary[] {
  // 代表チームと所属チームの和集合（重複なし）。
  const rows = db
    .prepare(
      `SELECT t.id, t.name, lu.nickname AS leader_nickname,
              CASE WHEN t.leader_user_id = ? THEN 1 ELSE 0 END AS is_leader
         FROM teams t
         JOIN users lu ON lu.id = t.leader_user_id
        WHERE t.leader_user_id = ?
           OR t.id IN (SELECT team_id FROM team_members WHERE user_id = ?)
        ORDER BY t.name ASC, t.id ASC`,
    )
    .all(userId, userId, userId) as unknown as TeamRaw[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    leaderNickname: r.leader_nickname,
    isLeader: r.is_leader === 1,
  }));
}

export function getUserDetail(id: string): UserDetail | null {
  const r = db
    .prepare(
      `SELECT u.id, u.login_id, u.real_name, u.kana_name, u.nickname, u.email, u.gender,
              u.birth_date, u.phone_number, u.role, u.status, u.gran_level, u.declared_class,
              u.is_level_calibrated, u.failed_login_attempts, u.locked_until, u.created_at,
              CASE WHEN ${LOCKED_SQL} THEN 1 ELSE 0 END AS locked
         FROM users u
        WHERE u.id = ?`,
    )
    .get(id) as unknown as DetailRowRaw | undefined;
  if (!r) return null;

  const teams = listUserTeams(id);
  return {
    id: r.id,
    loginId: r.login_id,
    realName: r.real_name,
    kanaName: r.kana_name,
    nickname: r.nickname,
    email: r.email,
    gender: r.gender,
    birthDate: r.birth_date,
    phoneNumber: r.phone_number,
    role: r.role,
    status: r.status,
    granLevel: r.gran_level,
    declaredClass: r.declared_class,
    isLevelCalibrated: r.is_level_calibrated === 1,
    locked: r.locked === 1,
    failedLoginAttempts: r.failed_login_attempts,
    lockedUntil: r.locked_until,
    createdAt: r.created_at,
    ledTeam: teams.find((t) => t.isLeader) ?? null,
    teams,
    activePersonalEntryCount: countActivePersonalEntries(id),
    logs: listLogsForTarget("USER", id),
  };
}

// ---------------------------------------------------------------------------
// 操作用の最小取得
// ---------------------------------------------------------------------------

export interface UserOpTarget {
  id: string;
  loginId: string;
  realName: string;
  role: UserRole;
  isAdmin: boolean;
  status: AccountStatus;
  declaredClass: DeclaredClass | null;
  granLevel: number;
  locked: boolean;
}

export function findUserForOperation(id: string): UserOpTarget | null {
  const r = db
    .prepare(
      `SELECT u.id, u.login_id, u.real_name, u.role, u.is_admin, u.status,
              u.declared_class, u.gran_level,
              CASE WHEN ${LOCKED_SQL} THEN 1 ELSE 0 END AS locked
         FROM users u
        WHERE u.id = ?`,
    )
    .get(id) as
    | {
        id: string;
        login_id: string;
        real_name: string;
        role: UserRole;
        is_admin: number;
        status: AccountStatus;
        declared_class: DeclaredClass | null;
        gran_level: number;
        locked: number;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    loginId: r.login_id,
    realName: r.real_name,
    role: r.role,
    isAdmin: r.is_admin === 1,
    status: r.status,
    declaredClass: r.declared_class,
    granLevel: r.gran_level,
    locked: r.locked === 1,
  };
}

// ---------------------------------------------------------------------------
// 作成（管理者用）
// ---------------------------------------------------------------------------

export function emailExists(email: string): boolean {
  const row = db
    .prepare("SELECT 1 AS x FROM users WHERE lower(email) = ? LIMIT 1")
    .get(email.trim().toLowerCase());
  return row !== undefined;
}

/** 次の login_id（6 桁ゼロ埋め）。101 から採番し、999999 を超える場合は null。 */
export function nextAdminLoginId(): string | null {
  const row = db
    .prepare(
      "SELECT MAX(CAST(login_id AS INTEGER)) AS maxId FROM users WHERE CAST(login_id AS INTEGER) >= ?",
    )
    .get(LOGIN_ID_START) as { maxId: number | null };
  const next = (row.maxId ?? LOGIN_ID_START - 1) + 1;
  if (next > LOGIN_ID_MAX) return null;
  return String(next).padStart(6, "0");
}

export type InsertUserResult =
  | { ok: true; id: string; loginId: string }
  | { ok: false; reason: "LOGIN_ID_EXHAUSTED" | "EMAIL_TAKEN" };

// BEGIN IMMEDIATE 内で呼ぶこと（採番と INSERT を直列化する）。
export function insertUser(input: CreateUserInput, passwordHash: string): InsertUserResult {
  const email = input.email.trim().toLowerCase();
  if (emailExists(email)) return { ok: false, reason: "EMAIL_TAKEN" };

  const loginId = nextAdminLoginId();
  if (loginId === null) return { ok: false, reason: "LOGIN_ID_EXHAUSTED" };

  const id = randomUUID();
  const calibrated = input.granLevel !== null;
  const granLevel = input.granLevel ?? calibrationMidpoint(input.declaredClass);

  try {
    db.prepare(
      `INSERT INTO users (
         id, login_id, email, password_hash, role, is_admin, status, is_initial_login,
         real_name, kana_name, nickname, gender, birth_date, phone_number,
         declared_class, gran_level, is_level_calibrated, rated_match_count,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0,
                 ${NOW_JST}, ${NOW_JST})`,
    ).run(
      id,
      loginId,
      email,
      passwordHash,
      input.role,
      input.role === "ADMIN" ? 1 : 0,
      input.realName,
      input.kanaName,
      input.nickname,
      input.gender,
      input.birthDate,
      input.phoneNumber,
      input.declaredClass,
      granLevel,
      calibrated ? 1 : 0,
    );
  } catch (e) {
    // 同時作成による UNIQUE 違反（メール）は競合として扱う。
    if (e instanceof Error && /UNIQUE constraint failed: users\.email/.test(e.message)) {
      return { ok: false, reason: "EMAIL_TAKEN" };
    }
    throw e;
  }
  return { ok: true, id, loginId };
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export function clearLock(userId: string): void {
  db.prepare(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = ${NOW_JST}
      WHERE id = ?`,
  ).run(userId);
}

// パスワード再発行。セッション失効（revokeSessions）は呼び出し側で行う。
export function resetPasswordHash(userId: string, passwordHash: string): void {
  db.prepare(
    `UPDATE users
        SET password_hash = ?, is_initial_login = 0, failed_login_attempts = 0,
            locked_until = NULL, updated_at = ${NOW_JST}
      WHERE id = ?`,
  ).run(passwordHash, userId);
}

export function updateStatus(userId: string, status: AccountStatus): void {
  db.prepare(`UPDATE users SET status = ?, updated_at = ${NOW_JST} WHERE id = ?`).run(
    status,
    userId,
  );
}

export function updateRole(userId: string, role: UserRole, isAdmin: boolean): void {
  db.prepare(
    `UPDATE users SET role = ?, is_admin = ?, updated_at = ${NOW_JST} WHERE id = ?`,
  ).run(role, isAdmin ? 1 : 0, userId);
}

export function updateGranLevel(userId: string, granLevel: number): void {
  db.prepare(
    `UPDATE users SET gran_level = ?, is_level_calibrated = 1, updated_at = ${NOW_JST}
      WHERE id = ?`,
  ).run(granLevel, userId);
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

// 前提確認（代表者・有効エントリー・履歴参照など）は呼び出し側で済ませておくこと。
// user_settings は users への ON DELETE CASCADE でも消えるが、明示的に削除する。
export function deleteUserCascade(userId: string): void {
  db.prepare("DELETE FROM team_members WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM team_invitations WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM inbox_notifications WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM user_settings WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

// ---------------------------------------------------------------------------
// 判定クエリ
// ---------------------------------------------------------------------------

/** 代表者（teams.leader_user_id）か。 */
export function isTeamLeader(userId: string): boolean {
  return (
    db.prepare("SELECT 1 AS x FROM teams WHERE leader_user_id = ? LIMIT 1").get(userId) !==
    undefined
  );
}

/** admin_account_logs の操作者として記録があるか。 */
export function isLogOperator(userId: string): boolean {
  return (
    db
      .prepare("SELECT 1 AS x FROM admin_account_logs WHERE operator_user_id = ? LIMIT 1")
      .get(userId) !== undefined
  );
}

/** 対象を除いた、有効な管理者（ACTIVE かつ role=ADMIN または is_admin=1）が居るか。停止の判定用。 */
export function hasOtherActiveAdmin(excludeUserId: string): boolean {
  return (
    db
      .prepare(
        `SELECT 1 AS x FROM users
          WHERE id <> ? AND status = 'ACTIVE' AND (role = 'ADMIN' OR is_admin = 1)
          LIMIT 1`,
      )
      .get(excludeUserId) !== undefined
  );
}

/** 対象を除いた、role=ADMIN かつ ACTIVE のユーザーが居るか。削除の判定用（Requirement 10.6）。 */
export function hasOtherActiveAdminRole(excludeUserId: string): boolean {
  return (
    db
      .prepare(
        "SELECT 1 AS x FROM users WHERE id <> ? AND status = 'ACTIVE' AND role = 'ADMIN' LIMIT 1",
      )
      .get(excludeUserId) !== undefined
  );
}

/** 削除すると FK 違反になる履歴（エントリー・戦績・通知ログ等）が残っているか。 */
export function hasHistoryReferences(userId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS x WHERE
         EXISTS (SELECT 1 FROM entries WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM entry_members WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM waitlists WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM tournament_results WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM notification_logs WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM entry_payment_logs WHERE changed_by = ?)`,
    )
    .get(userId, userId, userId, userId, userId, userId);
  return row !== undefined;
}
