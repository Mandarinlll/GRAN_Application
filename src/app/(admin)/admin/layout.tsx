// 管理コンソール共通レイアウト（/admin 配下）。
// ここでのガードは入口の防御。子ページ遷移時にレイアウトが再実行されない場合があるため、
// 各ページも必ず requireAdminPage() を呼ぶこと。
import { AdminShell } from "@/features/admin/components/AdminShell";
import { requireAdminPage } from "@/features/admin/server/guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
