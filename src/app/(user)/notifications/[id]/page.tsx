// 通知詳細ページ（URL: /notifications/[id]）。
// 本人の通知のみ表示し、開いた時点で既読にする。通知ごとの操作はこの画面でのみ行う。
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { NotificationDetail } from "@/features/notifications/components/NotificationDetail";
import {
  countUnread,
  findNotification,
  markRead,
} from "@/features/notifications/server/inboxRepository";

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) redirect("/login");

  const { id } = await params;
  const notification = findNotification(session.sub, id);
  if (!notification) notFound();
  if (!notification.isRead) markRead(session.sub, id);

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
        <Link
          href="/notifications"
          className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          通知一覧へ
        </Link>
        <NotificationDetail n={{ ...notification, isRead: true }} />
      </main>
    </AppShell>
  );
}
