// 管理者用のチーム更新サービス（メンバー除名・チーム解散）。
// 骨格: 認可 → runInTransaction（権限再評価・前提条件・更新・通知・ログ）→ コミット後の後始末。
// 前提条件を満たさない場合は ok:false を返し、トランザクションを ROLLBACK する。

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/features/admin/server/guard";
import { evaluateAdminAccess } from "@/features/admin/utils/permissions";
import { findUserById } from "@/features/auth/server/userRepository";
import { createNotificationIfAbsent } from "@/features/notifications/server/inboxRepository";
import { imageStorage, type ImageStorage } from "@/features/teams/server/imageStorage";
import {
  MSG_FORBIDDEN,
  MSG_INTERNAL,
  MSG_NOT_FOUND,
  MSG_UNAUTHENTICATED,
  authFailure,
} from "@/features/accounts/server/accessResult";
import { insertLog } from "@/features/accounts/server/adminLogRepository";
import {
  disbandTeam as repoDisbandTeam,
  findTeamBasics,
  listTeamRecipientIds,
  removeMember as repoRemoveMember,
} from "@/features/accounts/server/teamAdminRepository";
import type { ServiceResult } from "@/features/accounts/types/account";
import type { AdminContext } from "@/features/admin/types/permissions";
import { runInTransaction } from "@/lib/transaction";

export const MSG_IS_LEADER = "代表者は除名できません。";
export const MSG_NOT_MEMBER = "このチームのメンバーではありません。";
export const MSG_ASSIGNED_TO_ENTRY =
  "エントリーに割り当てられているメンバーは除名できません。先にエントリーの割り当てを変更してください。";
export const MSG_ACTIVE_TEAM_ENTRY =
  "有効なエントリーがあるため解散できません。先にエントリーをキャンセルしてください。";
export const MSG_CONFIRM_MISMATCH = "入力したチーム名が一致しません。";
export const MSG_AVATAR_DELETE_WARNING =
  "チームを解散しましたが、チームアイコンの削除に失敗しました。";

type Fail = Extract<ServiceResult<never>, { ok: false }>;

export interface TeamAdminDeps {
  storage: Pick<ImageStorage, "delete">;
}
const defaultDeps: TeamAdminDeps = { storage: imageStorage };

// トランザクション内で呼び出し者の権限を再評価する（認可からコミットまでの権限変更に備える）。
function recheckAdmin(admin: AdminContext): Fail | null {
  const r = evaluateAdminAccess(findUserById(admin.userId), "accounts.manage");
  if (r.ok) return null;
  return r.reason === "UNAUTHENTICATED"
    ? { ok: false, code: "UNAUTHENTICATED", message: MSG_UNAUTHENTICATED }
    : { ok: false, code: "FORBIDDEN", message: MSG_FORBIDDEN };
}

async function authorize(): Promise<{ admin: AdminContext } | { fail: Fail }> {
  try {
    return { admin: await requireAdmin("accounts.manage") };
  } catch (e) {
    const f = authFailure(e);
    if (f) return { fail: f };
    console.error(e);
    return { fail: { ok: false, code: "INTERNAL", message: MSG_INTERNAL } };
  }
}

const internal = (e: unknown): Fail => {
  console.error(e);
  return { ok: false, code: "INTERNAL", message: MSG_INTERNAL };
};

const REMOVE_MESSAGES = {
  NOT_FOUND: MSG_NOT_FOUND,
  IS_LEADER: MSG_IS_LEADER,
  NOT_MEMBER: MSG_NOT_MEMBER,
  ASSIGNED_TO_ENTRY: MSG_ASSIGNED_TO_ENTRY,
} as const;

// --- 除名 ---

export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<ServiceResult<undefined>> {
  const auth = await authorize();
  if ("fail" in auth) return auth.fail;
  const { admin } = auth;

  try {
    return runInTransaction<ServiceResult<undefined>>(() => {
      const denied = recheckAdmin(admin);
      if (denied) return denied;

      const r = repoRemoveMember(teamId, userId);
      if (!r.ok) {
        return r.reason === "NOT_FOUND"
          ? { ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND }
          : { ok: false, code: "CONFLICT", reason: r.reason, message: REMOVE_MESSAGES[r.reason] };
      }

      createNotificationIfAbsent({
        userId,
        kind: "ANNOUNCEMENT",
        tournamentId: null,
        entryId: null,
        title: "チームから除名されました",
        body: `「${r.teamName}」から運営により除名されました。`,
        dedupeKey: `TEAM_REMOVED:${teamId}:${userId}:${randomUUID()}`,
      });
      insertLog({
        action: "TEAM_MEMBER_REMOVED",
        targetType: "TEAM",
        targetId: teamId,
        operatorUserId: admin.userId,
        detail: { teamId, userId, teamName: r.teamName },
      });
      return { ok: true, data: undefined };
    });
  } catch (e) {
    return internal(e);
  }
}

// --- 解散 ---

export interface DisbandTeamData {
  /** アイコン削除に失敗した場合の警告（DB の結果は維持される）。 */
  warning?: string;
}

export async function disbandTeamAsAdmin(
  teamId: string,
  confirmName: unknown,
  deps: TeamAdminDeps = defaultDeps,
): Promise<ServiceResult<DisbandTeamData>> {
  const auth = await authorize();
  if ("fail" in auth) return auth.fail;
  const { admin } = auth;

  const saved: { avatarKey: string | null } = { avatarKey: null };
  let result: ServiceResult<DisbandTeamData>;
  try {
    result = runInTransaction<ServiceResult<DisbandTeamData>>(() => {
      const denied = recheckAdmin(admin);
      if (denied) return denied;

      const team = findTeamBasics(teamId);
      if (!team) return { ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND };

      // チーム名は完全一致（trim・大文字小文字の正規化なし）。
      if (typeof confirmName !== "string" || confirmName !== team.name) {
        return {
          ok: false,
          code: "VALIDATION",
          message: MSG_CONFIRM_MISMATCH,
          fieldErrors: { confirm: MSG_CONFIRM_MISMATCH },
        };
      }

      // 通知の宛先は、チームの行が消える前に取得する。
      const recipients = listTeamRecipientIds(teamId);

      // 通知は purge の前に登録する（前提条件を満たさなければ ROLLBACK で消える）。
      for (const uid of recipients) {
        createNotificationIfAbsent({
          userId: uid,
          kind: "ANNOUNCEMENT",
          tournamentId: null,
          entryId: null,
          title: "チームが解散されました",
          body: `「${team.name}」は運営により解散されました。`,
          dedupeKey: `TEAM_DISBANDED:${teamId}:${uid}`,
        });
      }

      const r = repoDisbandTeam(teamId);
      if (!r.ok) {
        return r.reason === "NOT_FOUND"
          ? { ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND }
          : {
              ok: false,
              code: "CONFLICT",
              reason: "ACTIVE_TEAM_ENTRY",
              message: MSG_ACTIVE_TEAM_ENTRY,
            };
      }

      insertLog({
        action: "TEAM_DISBANDED",
        targetType: "TEAM",
        targetId: teamId,
        operatorUserId: admin.userId,
        detail: { teamName: r.teamName, memberCount: recipients.length },
      });
      saved.avatarKey = r.avatarKey;
      return { ok: true, data: {} };
    });
  } catch (e) {
    return internal(e);
  }

  // コミット後にアイコンを削除する。失敗しても DB の結果は維持し、警告だけ付ける。
  if (result.ok && saved.avatarKey) {
    try {
      await deps.storage.delete(saved.avatarKey);
    } catch (e) {
      console.warn("team avatar delete failed", e);
      return { ok: true, data: { warning: MSG_AVATAR_DELETE_WARNING } };
    }
  }
  return result;
}
