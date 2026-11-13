// 通知ページ（URL: /notifications）。
// 表示のたびに通知を同期（リマインド・メンバー指定依頼の生成/解消）してから一覧を返す。
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { NotificationList } from "@/features/notifications/components/NotificationList";
import { syncNotificationsForUser } from "@/features/notifications/server/inboxService";
import {
  countUnread,
  listNotifications,
} from "@/features/notifications/server/inboxRepository";

export default async function NotificationsPage() {
  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) redirect("/login");

  syncNotificationsForUser(session.sub);
  const notifications = listNotifications(session.sub);

  const shellUser = {
    realName: user.realName,
    nickname: user.nickname,
    granLevel: user.granLevel,
    avatarText: user.avatarText,
    teamName: user.teamName || null,
    unreadNotifications: countUnread(session.sub),
  };

  return (
    <AppShell activeId="notifications" user={shellUser}>
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">
            通知
          </h1>
        </div>
        <NotificationList notifications={notifications} />
      </main>
    </AppShell>
  );
}
