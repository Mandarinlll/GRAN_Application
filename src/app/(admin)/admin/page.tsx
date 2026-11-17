// 管理コンソールのトップ（URL: /admin）。ダッシュボード。
import { requireAdminPage } from "@/features/admin/server/guard";
import { DashboardView } from "@/features/dashboard/components/DashboardView";
import { dashboardRepository } from "@/features/dashboard/server/dashboardRepository";

// ログイン時点の日時で集計するため、毎回動的に描画する。
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdminPage("console.access");
  return <DashboardView data={dashboardRepository.getDashboard()} />;
}
