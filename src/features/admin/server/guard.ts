// 管理コンソールのサーバー側権限ガード。ページ・Server Action・API Route から共通で使う。
//
// 方針:
//  - 判定は常にサーバーで行い、毎回 DB の最新の role / status を参照する
//    （JWT 内の role は発行時点の値で、降格・停止後も残るため信用しない）。
//  - レイアウトは遷移時に再実行されないことがあるため、各ページ・各 Action・各 Route が
//    自分でガードを呼ぶこと（layout のガードだけに頼らない）。

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/features/auth/server/userRepository";
import { evaluateAdminAccess } from "@/features/admin/utils/permissions";
import type {
  AdminAccessResult,
  AdminContext,
  AdminDenyReason,
  AdminPermission,
} from "@/features/admin/types/permissions";

// 現在のリクエストの管理者認可結果を返す（例外・リダイレクトなし）。
export async function getAdminAccess(
  permission: AdminPermission = "console.access",
): Promise<AdminAccessResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "UNAUTHENTICATED" };
  return evaluateAdminAccess(findUserById(session.sub), permission);
}

// ---- ページ / レイアウト用 ----
// 未ログインはログインへ、権限不足は存在を隠すため 404 とする。
export async function requireAdminPage(
  permission: AdminPermission = "console.access",
): Promise<AdminContext> {
  const result = await getAdminAccess(permission);
  if (result.ok) return result.admin;
  if (result.reason === "UNAUTHENTICATED") redirect("/login");
  notFound();
}

// ---- Server Action 用 ----
// 権限エラーを表す例外。
export class AdminAccessError extends Error {
  constructor(public readonly reason: AdminDenyReason) {
    super(reason === "UNAUTHENTICATED" ? "ログインが必要です。" : "権限がありません。");
    this.name = "AdminAccessError";
  }
}

// 認可できなければ AdminAccessError を投げる。
export async function requireAdmin(
  permission: AdminPermission = "console.access",
): Promise<AdminContext> {
  const result = await getAdminAccess(permission);
  if (!result.ok) throw new AdminAccessError(result.reason);
  return result.admin;
}

// Server Action を権限チェックで包む。権限がなければ本体を実行せず { ok:false } を返す。
// 使い方: export const deleteUser = withAdminAction("accounts.manage", async (admin, id: string) => {...});
export function withAdminAction<Args extends unknown[], R extends { ok: boolean }>(
  permission: AdminPermission,
  action: (admin: AdminContext, ...args: Args) => Promise<R>,
): (...args: Args) => Promise<R | { ok: false; message: string }> {
  return async (...args: Args) => {
    const result = await getAdminAccess(permission);
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "UNAUTHENTICATED"
            ? "ログインが必要です。"
            : "この操作を行う権限がありません。",
      };
    }
    return action(result.admin, ...args);
  };
}

// ---- API Route 用 ----
// Route Handler を権限チェックで包む。未ログインは 401、権限不足は 403。
// 使い方: export const GET = withAdminApi("entries.view", async (req, ctx, admin) => Response.json(...));
export function withAdminApi<Ctx = unknown>(
  permission: AdminPermission,
  handler: (req: Request, ctx: Ctx, admin: AdminContext) => Promise<Response> | Response,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const result = await getAdminAccess(permission);
    if (!result.ok) {
      const unauthenticated = result.reason === "UNAUTHENTICATED";
      return Response.json(
        { error: unauthenticated ? "UNAUTHENTICATED" : "FORBIDDEN" },
        { status: unauthenticated ? 401 : 403 },
      );
    }
    return handler(req, ctx, result.admin);
  };
}
