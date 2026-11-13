// 通知ページ（URL: /notifications）。
// サーバーコンポーネント。セッション検証 → 通知を最新化して取得 →
// 「メンバー指定」に必要なエントリー情報とあわせてクライアントへ渡す。
//
// 元モック: tests/notifications.html

import { redirect } from "next/navigation";
import { getEntryViewer } from "@/features/entries/server/entryViewData";
import {
  createEntryApplicationService,
  createInboxNotificationService,
} from "@/server/container";
import { NotificationsView } from "@/features/notifications/components/NotificationsView";
import type { EntrySummary } from "@/features/entries/types/entry";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const viewer = await getEntryViewer();
  if (!viewer) redirect("/login");

  const notifications = createInboxNotificationService().list(viewer.userId);

  // 未対応の「メンバー未定」通知から、メンバー指定モーダルに渡すエントリー情報を解決する。
  const pendingEntryIds = new Set(
    notifications
      .filter((n) => n.kind === "MEMBER_PENDING" && !n.resolvedAt && n.entryId)
      .map((n) => n.entryId as string),
  );
  const entries: Record<string, EntrySummary> = {};
  if (pendingEntryIds.size > 0) {
    const mine = createEntryApplicationService().listMyEntries(viewer.userId);
    for (const e of [...mine.personal, ...mine.team]) {
      if (pendingEntryIds.has(e.entryId)) entries[e.entryId] = e;
    }
  }

  const unreadCount = notifications.filter(
    (n) => !n.isRead && !n.resolvedAt,
  ).length;

  return (
    <NotificationsView
      notifications={notifications}
      entries={entries}
      viewer={viewer}
      unreadCount={unreadCount}
    />
  );
}
