// ユーザー画面共通レイアウト。管理者/運営者でプレビュー中は、全ページ上部にバナーを出す。
// （ホーム "/" は (user) グループ外のため、src/app/page.tsx で同じバナーを表示している）
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
