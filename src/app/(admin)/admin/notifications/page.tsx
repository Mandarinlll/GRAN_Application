// 通知管理（URL: /admin/notifications）。
// タブ: 「お知らせ・緊急連絡」（既定）/「トピックス」（?tab=topics）。
// 各タブの権限はサーバー側で判定し、権限が無いタブは表示しない。
import Link from "next/link";
import { requireAdminPage } from "@/features/admin/server/guard";
import { roleHasPermission } from "@/features/admin/utils/permissions";
import { cn } from "@/lib/utils";
import { AnnouncementsManager } from "@/features/notifications/components/AnnouncementsManager";
import {
  listAnnouncements,
  listTournamentOptions,
} from "@/features/notifications/server/announcementRepository";
import { listAllTopics } from "@/features/topics/server/topicAdminRepository";
import { TopicsManager } from "@/features/topics/components/TopicsManager";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await requireAdminPage("notifications.manage");
  const { tab } = await searchParams;
  const canTopics = roleHasPermission(admin.role, "topics.manage");
  const active = tab === "topics" && canTopics ? "topics" : "announcements";

  const tabs = [
    { id: "announcements", label: "お知らせ・緊急連絡", href: "/admin/notifications" },
    ...(canTopics ? [{ id: "topics", label: "トピックス", href: "/admin/notifications?tab=topics" }] : []),
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">通知管理</h1>
      <nav aria-label="通知管理のタブ" className="flex gap-1.5 border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active === t.id ? "page" : undefined}
            className={cn(
              "min-h-[44px] px-4 inline-flex items-center text-sm font-bold border-b-2 -mb-px transition",
              active === t.id
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {active === "topics" ? (
        <TopicsManager topics={listAllTopics()} />
      ) : (
        <AnnouncementsManager announcements={listAnnouncements()} tournaments={listTournamentOptions()} />
      )}
    </div>
  );
}