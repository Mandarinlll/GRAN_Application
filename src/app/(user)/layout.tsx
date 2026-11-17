// ユーザー画面共通レイアウト（/home, /tournaments, /data, /notifications, /team, /settings）。
//  - 管理者/運営者でプレビュー中は、全ページ上部にバナーを出す。
//  - 管理者/運営者は、ナビ（AppShell）を管理者用のものに差し替える（AdminNavProvider 経由）。
//    ロールはセッション(JWT)ではなく DB の最新値で判定する（getAdminAccess）。
import { AdminBanner } from "@/components/home/AdminBanner";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { getAdminAccess } from "@/features/admin/server/guard";
import { AdminNavProvider } from "@/features/admin/components/AdminNavContext";
import { allowedAdminNavIds } from "@/features/admin/utils/navConfig";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const access = user ? await getAdminAccess() : null;
  const adminNavIds = access?.ok ? allowedAdminNavIds(access.admin.role) : null;

  return (
    <AdminNavProvider allowedIds={adminNavIds}>
      {user ? (
        // 固定サイドバー（sm:w-60）に隠れないよう、AppShell と同じ左余白を付ける。
        <div className="sm:pl-60">
          <AdminBanner
            role={user.role === "OPERATOR" ? "OPERATOR" : "ADMIN"}
            visible={user.isAdminPreview}
          />
        </div>
      ) : null}
      {children}
    </AdminNavProvider>
  );
}
