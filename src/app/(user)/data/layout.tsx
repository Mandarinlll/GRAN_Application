// データタブ共通レイアウト（/data/me, /data/participations, /data/ranking）。
// 認証チェック → AppShell(activeId="data") + DataTabs。
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { getSession } from "@/lib/session";
import { getUnreadCountSynced } from "@/features/notifications/server/inboxService";
import { DataTabs } from "@/features/data/components/DataTabs";

export default async function DataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = {
    realName: user.realName,
    nickname: user.nickname,
    granLevel: user.granLevel,
    avatarText: user.avatarText,
    teamName: user.teamName || null,
    unreadNotifications: getUnreadCountSynced((await getSession())!.sub),
  };

  return (
    <AppShell activeId="data" user={shellUser}>
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-4">
        <DataTabs />
        {children}
      </main>
    </AppShell>
  );
}
