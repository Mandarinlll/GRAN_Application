// 管理者ガードの API Route 適用例。管理者として認可されたユーザー自身の情報を返す。
import { withAdminApi } from "@/features/admin/server/guard";

export const GET = withAdminApi("console.access", (_req, _ctx, admin) =>
  Response.json({ userId: admin.userId, loginId: admin.loginId, role: admin.role }),
);
