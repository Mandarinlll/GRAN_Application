// 閲覧サービス共通: requireAdmin("accounts.manage") の結果を ServiceResult に変換する。
// 認可に失敗した場合は DB に触れずに Unified_Error を返す。

import { AdminAccessError, requireAdmin } from "@/features/admin/server/guard";
import type { AdminContext } from "@/features/admin/types/permissions";
import type { ServiceResult } from "@/features/accounts/types/account";

export const MSG_UNAUTHENTICATED = "ログインが必要です。";
export const MSG_FORBIDDEN = "この操作を行う権限がありません。";
export const MSG_NOT_FOUND = "対象が見つかりません。";
export const MSG_INTERNAL = "処理中にエラーが発生しました。時間をおいて再度お試しください。";

type Fail = Extract<ServiceResult<never>, { ok: false }>;

export function authFailure(e: unknown): Fail | null {
  if (e instanceof AdminAccessError) {
    return e.reason === "UNAUTHENTICATED"
      ? { ok: false, code: "UNAUTHENTICATED", message: MSG_UNAUTHENTICATED }
      : { ok: false, code: "FORBIDDEN", message: MSG_FORBIDDEN };
  }
  return null;
}

// 認可 → 本体の順に実行する。本体の例外は INTERNAL に変換（詳細は応答に出さない）。
export async function withAccountsManage<T>(
  body: (admin: AdminContext) => T,
): Promise<ServiceResult<T>> {
  let admin: AdminContext;
  try {
    admin = await requireAdmin("accounts.manage");
  } catch (e) {
    const f = authFailure(e);
    if (f) return f;
    console.error(e);
    return { ok: false, code: "INTERNAL", message: MSG_INTERNAL };
  }
  try {
    return { ok: true, data: body(admin) };
  } catch (e) {
    console.error(e);
    return { ok: false, code: "INTERNAL", message: MSG_INTERNAL };
  }
}
