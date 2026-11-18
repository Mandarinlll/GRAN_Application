// 管理コンソールの権限判定（純粋関数。DB・Cookie には触れない）。

import type { User } from "@/types/user";
import type {
  AdminAccessResult,
  AdminPermission,
  AdminRole,
} from "@/features/admin/types/permissions";

// ロールごとの許可操作。
// 運営者（OPERATOR）はスコア入力・エントリー確認のみ。アカウント削除・大会料金変更・
// 権限変更は管理者（ADMIN）のみ（requirements-detail-administrator.md 1.3）。
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  ADMIN: [
    "console.access",
    "entries.view",
    "entries.manage",
    "scores.input",
    "topics.manage",
    "tournaments.manage",
    "accounts.manage",
    "roles.manage",
  ],
  // トピックス管理は ADMIN / OPERATOR 双方に許可（仕様決定事項）。
  OPERATOR: ["console.access", "entries.view", "scores.input", "topics.manage"],
};

// users の行から管理コンソール上のロールを決定する。管理者でなければ null。
//  - role が ADMIN / OPERATOR ならそのまま採用。
//  - role が他でも is_admin = true なら入場可（要件 1.1）。既存コードが is_admin を
//    管理者扱いしていることに合わせ、ADMIN として扱う。
//  - ACTIVE 以外（停止中・仮登録）のアカウントは入場不可。
export function resolveAdminRole(
  user: Pick<User, "role" | "isAdmin" | "status">,
): AdminRole | null {
  if (user.status !== "ACTIVE") return null;
  if (user.role === "ADMIN") return "ADMIN";
  if (user.role === "OPERATOR") return "OPERATOR";
  if (user.isAdmin) return "ADMIN";
  return null;
}

// ログイン成功後の遷移先。管理コンソールに入れるユーザーは /admin、それ以外はホーム。
export function postLoginPath(
  user: Pick<User, "role" | "isAdmin" | "status">,
): "/admin" | "/home" {
  return resolveAdminRole(user) ? "/admin" : "/home";
}

// ロールが権限を持つか。
export function roleHasPermission(
  role: AdminRole,
  permission: AdminPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// DB から解決した最新のユーザー（未存在なら null）に対する認可判定。
// セッション(JWT)内の role は発行時点の値で古い可能性があるため、必ず DB の値で判定する。
export function evaluateAdminAccess(
  user: User | null,
  permission: AdminPermission = "console.access",
): AdminAccessResult {
  if (!user) return { ok: false, reason: "UNAUTHENTICATED" };

  const role = resolveAdminRole(user);
  if (!role || !roleHasPermission(role, permission)) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  return { ok: true, admin: { userId: user.id, loginId: user.loginId, role } };
}
