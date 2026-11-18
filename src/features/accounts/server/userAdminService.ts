// ユーザー管理の更新サービス（作成・ロック解除・パスワード再発行・停止・再開）。
// 骨格: 入力検証 → requireAdmin("accounts.manage") → runInTransaction
//       （呼び出しユーザーの権限再評価 → 前提条件 → 更新 → セッション失効 → ログ）→ 例外は INTERNAL。

import { requireAdmin } from "@/features/admin/server/guard";
import { evaluateAdminAccess, roleHasPermission } from "@/features/admin/utils/permissions";
import type { AdminContext, AdminPermission } from "@/features/admin/types/permissions";
import { findUserById } from "@/features/auth/server/userRepository";
import {
  authFailure,
  MSG_FORBIDDEN,
  MSG_INTERNAL,
  MSG_NOT_FOUND,
  MSG_UNAUTHENTICATED,
} from "@/features/accounts/server/accessResult";
import { insertLog } from "@/features/accounts/server/adminLogRepository";
import {
  clearLock,
  deleteUserCascade,
  findUserForOperation,
  hasActivePersonalEntry,
  hasHistoryReferences,
  hasOtherActiveAdmin,
  hasOtherActiveAdminRole,
  insertUser,
  isLogOperator,
  isTeamLeader,
  resetPasswordHash,
  updateGranLevel,
  updateRole,
  updateStatus,
} from "@/features/accounts/server/userAdminRepository";
import {
  CALIBRATION_RANGE,
  isOutOfRange,
  parseGranLevel,
} from "@/features/accounts/utils/calibration";
import { planRoleChange } from "@/features/accounts/utils/roleChange";
import type { ServiceResult } from "@/features/accounts/types/account";
import { parseCreateUserInput } from "@/features/accounts/types/userSchema";
import { generateInitialPassword } from "@/features/accounts/utils/initialPassword";
import { planStatusChange, type StatusAction } from "@/features/accounts/utils/statusTransition";
import type { UserRole } from "@/types/user";
import { hashPassword } from "@/lib/password";
import { revokeSessions } from "@/lib/sessionState";
import { runInTransaction } from "@/lib/transaction";

type Fail = Extract<ServiceResult<never>, { ok: false }>;
type TxResult<T> = { ok: true; data: T } | Fail;

const fail = (
  code: Fail["code"],
  message: string,
  extra: { reason?: string; fieldErrors?: Record<string, string> } = {},
): Fail => ({ ok: false, code, message, ...extra });

export const MSG_EMAIL_TAKEN = "このメールアドレスは既に登録されています。";
export const MSG_LOGIN_ID_EXHAUSTED = "ユーザーIDを採番できません（上限に達しています）。";
export const MSG_NOT_LOCKED = "このアカウントはロックされていません。";
export const MSG_SELF_TARGET = "自分自身のアカウントは操作できません。";
export const MSG_LAST_ADMIN = "有効な管理者が他にいないため、停止できません。";
export const MSG_INVALID_STATE = "現在のアカウント状態ではこの操作を実行できません。";

// 認可 → トランザクション。トランザクション内で呼び出しユーザーの権限を再評価する。
// extraPermission を指定すると、accounts.manage に加えてその権限も要求する（権限変更: roles.manage）。
async function runAdminOperation<T>(
  body: (admin: AdminContext) => TxResult<T>,
  prepare?: () => Promise<void>,
  extraPermission?: AdminPermission,
): Promise<ServiceResult<T>> {
  let admin: AdminContext;
  try {
    admin = await requireAdmin("accounts.manage");
    if (extraPermission && !roleHasPermission(admin.role, extraPermission)) {
      return fail("FORBIDDEN", MSG_FORBIDDEN);
    }
  } catch (e) {
    const f = authFailure(e);
    if (f) return f;
    console.error(e);
    return fail("INTERNAL", MSG_INTERNAL);
  }
  try {
    if (prepare) await prepare();
    return runInTransaction<TxResult<T>>(() => {
      const access = evaluateAdminAccess(findUserById(admin.userId), "accounts.manage");
      if (!access.ok) {
        return access.reason === "UNAUTHENTICATED"
          ? fail("UNAUTHENTICATED", MSG_UNAUTHENTICATED)
          : fail("FORBIDDEN", MSG_FORBIDDEN);
      }
      if (extraPermission && !roleHasPermission(access.admin.role, extraPermission)) {
        return fail("FORBIDDEN", MSG_FORBIDDEN);
      }
      return body(access.admin);
    });
  } catch (e) {
    console.error(e);
    return fail("INTERNAL", MSG_INTERNAL);
  }
}

// ---------------------------------------------------------------------------
// 作成
// ---------------------------------------------------------------------------

export interface CreateUserData {
  id: string;
  loginId: string;
  initialPassword: string;
}

export async function createUser(raw: unknown): Promise<ServiceResult<CreateUserData>> {
  const parsed = parseCreateUserInput(raw);
  if (!parsed.ok) {
    return fail("VALIDATION", "入力内容に誤りがあります。", { fieldErrors: parsed.fieldErrors });
  }
  const input = parsed.data;
  const initialPassword = generateInitialPassword();
  let passwordHash = "";

  return runAdminOperation<CreateUserData>(
    (admin) => {
      const r = insertUser(input, passwordHash);
      if (!r.ok) {
        return r.reason === "EMAIL_TAKEN"
          ? fail("VALIDATION", MSG_EMAIL_TAKEN, { fieldErrors: { email: MSG_EMAIL_TAKEN } })
          : fail("VALIDATION", MSG_LOGIN_ID_EXHAUSTED, {
              fieldErrors: { form: MSG_LOGIN_ID_EXHAUSTED },
            });
      }
      insertLog({
        action: "USER_CREATED",
        targetType: "USER",
        targetId: r.id,
        operatorUserId: admin.userId,
        detail: { loginId: r.loginId, role: input.role },
      });
      return { ok: true, data: { id: r.id, loginId: r.loginId, initialPassword } };
    },
    async () => {
      passwordHash = await hashPassword(initialPassword);
    },
  );
}

// ---------------------------------------------------------------------------
// ロック解除
// ---------------------------------------------------------------------------

export async function unlockUser(targetId: string): Promise<ServiceResult<undefined>> {
  return runAdminOperation<undefined>((admin) => {
    const target = findUserForOperation(targetId);
    if (!target) return fail("NOT_FOUND", MSG_NOT_FOUND);
    if (!target.locked) return fail("CONFLICT", MSG_NOT_LOCKED, { reason: "NOT_LOCKED" });
    clearLock(target.id);
    insertLog({
      action: "LOCK_RELEASED",
      targetType: "USER",
      targetId: target.id,
      operatorUserId: admin.userId,
      detail: { loginId: target.loginId },
    });
    return { ok: true, data: undefined };
  });
}

// ---------------------------------------------------------------------------
// パスワード再発行
// ---------------------------------------------------------------------------

export async function resetUserPassword(
  targetId: string,
): Promise<ServiceResult<{ initialPassword: string }>> {
  const initialPassword = generateInitialPassword();
  let passwordHash = "";

  return runAdminOperation<{ initialPassword: string }>(
    (admin) => {
      const target = findUserForOperation(targetId);
      if (!target) return fail("NOT_FOUND", MSG_NOT_FOUND);
      resetPasswordHash(target.id, passwordHash);
      revokeSessions(target.id);
      insertLog({
        action: "PASSWORD_RESET",
        targetType: "USER",
        targetId: target.id,
        operatorUserId: admin.userId,
        detail: { loginId: target.loginId },
      });
      return { ok: true, data: { initialPassword } };
    },
    async () => {
      passwordHash = await hashPassword(initialPassword);
    },
  );
}

// ---------------------------------------------------------------------------
// 停止・再開
// ---------------------------------------------------------------------------

async function changeStatus(
  targetId: string,
  action: StatusAction,
): Promise<ServiceResult<undefined>> {
  return runAdminOperation<undefined>((admin) => {
    const target = findUserForOperation(targetId);
    if (!target) return fail("NOT_FOUND", MSG_NOT_FOUND);

    if (action === "SUSPEND" && target.id === admin.userId) {
      return fail("CONFLICT", MSG_SELF_TARGET, { reason: "SELF_TARGET" });
    }
    const plan = planStatusChange(target.status, action);
    if (!plan.ok) return fail("CONFLICT", MSG_INVALID_STATE, { reason: "INVALID_STATE" });

    if (action === "SUSPEND") {
      if (!hasOtherActiveAdmin(target.id)) {
        return fail("CONFLICT", MSG_LAST_ADMIN, { reason: "LAST_ADMIN" });
      }
      updateStatus(target.id, plan.to);
      revokeSessions(target.id);
    } else {
      updateStatus(target.id, plan.to);
    }

    insertLog({
      action: action === "SUSPEND" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REACTIVATED",
      targetType: "USER",
      targetId: target.id,
      operatorUserId: admin.userId,
      detail: { loginId: target.loginId },
    });
    return { ok: true, data: undefined };
  });
}

export function suspendUser(targetId: string): Promise<ServiceResult<undefined>> {
  return changeStatus(targetId, "SUSPEND");
}

export function reactivateUser(targetId: string): Promise<ServiceResult<undefined>> {
  return changeStatus(targetId, "REACTIVATE");
}

// ---------------------------------------------------------------------------
// 権限変更（accounts.manage + roles.manage）
// ---------------------------------------------------------------------------

export const MSG_ROLE_INVALID = "指定された権限が正しくありません。";
export const MSG_ROLE_UNCHANGED = "現在の権限と同じです。";
export const MSG_LEADER_NEEDS_TEAM = "チームの代表者ではないため、代表者権限には変更できません。";
export const MSG_LEADER_ROLE_REQUIRED =
  "チームの代表者のため、一般ユーザーには変更できません。先にチームを解散してください。";

export async function changeUserRole(
  targetId: string,
  requestedRole: unknown,
): Promise<ServiceResult<undefined>> {
  return runAdminOperation<undefined>(
    (admin) => {
      const target = findUserForOperation(targetId);
      if (!target) return fail("NOT_FOUND", MSG_NOT_FOUND);

      const plan = planRoleChange({
        actorId: admin.userId,
        targetId: target.id,
        current: target.role,
        requested: requestedRole,
        isTeamLeader: isTeamLeader(target.id),
      });
      switch (plan.kind) {
        case "SELF_TARGET":
          return fail("CONFLICT", MSG_SELF_TARGET, { reason: "SELF_TARGET" });
        case "INVALID_VALUE":
          return fail("VALIDATION", MSG_ROLE_INVALID, { fieldErrors: { role: MSG_ROLE_INVALID } });
        case "UNCHANGED":
          return fail("CONFLICT", MSG_ROLE_UNCHANGED, { reason: "ROLE_UNCHANGED" });
        case "LEADER_NEEDS_TEAM":
          return fail("CONFLICT", MSG_LEADER_NEEDS_TEAM, { reason: "LEADER_NEEDS_TEAM" });
        case "LEADER_ROLE_REQUIRED":
          return fail("CONFLICT", MSG_LEADER_ROLE_REQUIRED, { reason: "LEADER_ROLE_REQUIRED" });
        case "APPLY":
          break;
      }

      updateRole(target.id, requestedRole as UserRole, plan.isAdmin);
      revokeSessions(target.id);
      insertLog({
        action: "ROLE_CHANGED",
        targetType: "USER",
        targetId: target.id,
        operatorUserId: admin.userId,
        detail: { from: target.role, to: requestedRole as UserRole },
      });
      return { ok: true, data: undefined };
    },
    undefined,
    "roles.manage",
  );
}

// ---------------------------------------------------------------------------
// 初期レベル査定
// ---------------------------------------------------------------------------

export const MSG_GRAN_LEVEL_INVALID = "Granレベルは100〜999の整数で入力してください。";

export type CalibrateData =
  | { applied: true }
  | { applied: false; needsConfirmation: true; range: [number, number] };

export async function calibrateUser(
  targetId: string,
  granLevelInput: unknown,
  confirmOutOfRange: unknown = false,
): Promise<ServiceResult<CalibrateData>> {
  const granLevel = parseGranLevel(granLevelInput);
  if (granLevel === null) {
    return fail("VALIDATION", MSG_GRAN_LEVEL_INVALID, {
      fieldErrors: { granLevel: MSG_GRAN_LEVEL_INVALID },
    });
  }
  const confirmed = confirmOutOfRange === true;

  return runAdminOperation<CalibrateData>((admin) => {
    const target = findUserForOperation(targetId);
    if (!target) return fail("NOT_FOUND", MSG_NOT_FOUND);

    if (target.declaredClass && isOutOfRange(target.declaredClass, granLevel) && !confirmed) {
      const [min, max] = CALIBRATION_RANGE[target.declaredClass];
      return { ok: true, data: { applied: false, needsConfirmation: true, range: [min, max] } };
    }

    updateGranLevel(target.id, granLevel);
    insertLog({
      action: "LEVEL_CALIBRATED",
      targetType: "USER",
      targetId: target.id,
      operatorUserId: admin.userId,
      detail: { from: target.granLevel, to: granLevel },
    });
    return { ok: true, data: { applied: true } };
  });
}

// ---------------------------------------------------------------------------
// 削除
// ---------------------------------------------------------------------------

export const MSG_USER_CONFIRM_MISMATCH = "入力したユーザーIDが一致しません。";
export const MSG_TEAM_LEADER = "チームの代表者のため削除できません。先にチームを解散してください。";
export const MSG_ACTIVE_ENTRY =
  "有効なエントリーがあるため削除できません。先にエントリーをキャンセルしてください。";
export const MSG_LAST_ADMIN_DELETE = "有効な管理者が他にいないため、削除できません。";
export const MSG_LOG_OPERATOR = "管理操作の履歴に操作者として記録されているため削除できません。";
export const MSG_HAS_HISTORY =
  "大会参加や通知などの履歴が残っているため削除できません。アカウントの停止を利用してください。";

export async function deleteUser(
  targetId: string,
  confirmLoginId: unknown,
): Promise<ServiceResult<undefined>> {
  return runAdminOperation<undefined>((admin) => {
    const target = findUserForOperation(targetId);
    if (!target) return fail("NOT_FOUND", MSG_NOT_FOUND);

    // ユーザーID（login_id）は完全一致（trim・正規化なし）。
    if (typeof confirmLoginId !== "string" || confirmLoginId !== target.loginId) {
      return fail("VALIDATION", MSG_USER_CONFIRM_MISMATCH, {
        fieldErrors: { confirm: MSG_USER_CONFIRM_MISMATCH },
      });
    }
    if (target.id === admin.userId) {
      return fail("CONFLICT", MSG_SELF_TARGET, { reason: "SELF_TARGET" });
    }
    if (isTeamLeader(target.id)) {
      return fail("CONFLICT", MSG_TEAM_LEADER, { reason: "TEAM_LEADER" });
    }
    if (hasActivePersonalEntry(target.id)) {
      return fail("CONFLICT", MSG_ACTIVE_ENTRY, { reason: "ACTIVE_ENTRY" });
    }
    if (target.role === "ADMIN" && target.status === "ACTIVE" && !hasOtherActiveAdminRole(target.id)) {
      return fail("CONFLICT", MSG_LAST_ADMIN_DELETE, { reason: "LAST_ADMIN" });
    }
    if (isLogOperator(target.id)) {
      return fail("CONFLICT", MSG_LOG_OPERATOR, { reason: "LOG_OPERATOR" });
    }
    if (hasHistoryReferences(target.id)) {
      return fail("CONFLICT", MSG_HAS_HISTORY, { reason: "HAS_HISTORY" });
    }

    deleteUserCascade(target.id);
    insertLog({
      action: "USER_DELETED",
      targetType: "USER",
      targetId: target.id,
      operatorUserId: admin.userId,
      detail: { loginId: target.loginId, realName: target.realName },
    });
    return { ok: true, data: undefined };
  });
}
