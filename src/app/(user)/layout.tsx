// ユーザー画面共通レイアウト（/home, /tournaments, /data, /notifications, /team, /settings）。
// 管理者/運営者でプレビュー中は、全ページ上部にバナーを出す。
// ナビはユーザー用（AppShell）のみ。管理者用ナビは /admin 配下（AdminShell）でだけ表示する。
import { AdminBanner } from "@/components/home/AdminBanner";
import { getCurrentUser } from "@/features/auth/server/currentUser";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <>
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
    </>
  );
}
