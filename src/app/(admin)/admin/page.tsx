// 管理コンソールのトップ（URL: /admin）。ダッシュボード本体（A-02）は今後実装する。
import { requireAdminPage } from "@/features/admin/server/guard";

export default async function AdminHomePage() {
  const admin = await requireAdminPage("console.access");

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <h1 className="text-lg font-bold text-slate-900">ダッシュボード</h1>
      <p className="text-sm text-slate-600 mt-2">
        ログインID {admin.loginId} としてログイン中です。
      </p>
    </section>
  );
}
