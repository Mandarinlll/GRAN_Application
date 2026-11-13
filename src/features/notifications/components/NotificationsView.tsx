// 通知ページのクライアントコンポーネント（絞り込み・既読・メンバー指定への導線）。
// 元モック: tests/notifications.html
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Filter,
  FilterX,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { EditMembersModal } from "@/features/entries/components/EditMembersModal";
import type { EntryViewer } from "@/features/entries/server/entryViewData";
import type { EntrySummary } from "@/features/entries/types/entry";
import {
  INBOX_CATEGORIES,
  type InboxCategory,
  type InboxNotification,
} from "@/features/notifications/domain/InboxNotification";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/server/inboxActions";

type Props = {
  notifications: InboxNotification[];
  // 未対応の「メンバー未定」通知に対応するエントリー（entryId → 概要）。
  entries: Record<string, EntrySummary>;
  viewer: EntryViewer;
  unreadCount: number;
};

const CATEGORY_LABEL: Record<InboxCategory, string> = {
  ACTION: "要対応",
  ENTRY: "エントリー",
  LEVEL: "GRANレベル",
  OTHER: "その他",
};

// "2026-09-10 10:00:00" → "2026/09/10 10:00"
function formatDateTime(value: string): string {
  return value.slice(0, 16).replace(/-/g, "/");
}

export function NotificationsView({
  notifications,
  entries,
  viewer,
  unreadCount,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [active, setActive] = useState<Set<InboxCategory>>(
    () => new Set(INBOX_CATEGORIES),
  );
  const [editTarget, setEditTarget] = useState<EntrySummary | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const counts = useMemo(() => {
    const result: Record<InboxCategory, number> = {
      ACTION: 0,
      ENTRY: 0,
      LEVEL: 0,
      OTHER: 0,
    };
    for (const n of notifications) result[n.category] += 1;
    return result;
  }, [notifications]);

  const visible = notifications.filter((n) => active.has(n.category));

  function toggleCategory(category: InboxCategory) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function markRead(n: InboxNotification) {
    if (n.isRead || n.resolvedAt) return;
    await markNotificationReadAction(n.id);
    refresh();
  }

  async function markAllRead() {
    const res = await markAllNotificationsReadAction();
    if (res.ok) showToast(res.message ?? "既読にしました", "success");
    refresh();
  }

  async function openMemberEditor(n: InboxNotification) {
    const entry = n.entryId ? entries[n.entryId] : undefined;
    if (!entry) {
      showToast("対象のエントリーが見つかりません。", "error");
      return;
    }
    await markRead(n);
    setEditTarget(entry);
  }

  const shellUser = {
    realName: viewer.realName,
    nickname: viewer.nickname,
    granLevel: viewer.granLevel,
    avatarText: viewer.realName.charAt(0) || "?",
    teamName: viewer.team?.name ?? null,
  };

  return (
    <AppShell
      activeId="notifications"
      user={shellUser}
      unreadNotifications={unreadCount}
    >
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* ヘッダー */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="text-base font-bold text-slate-900">
                通知・お知らせ
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="min-h-[44px] px-3 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
                >
                  すべて既読にする
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
                aria-controls="notification-filter-panel"
                className={cn(
                  "min-h-[44px] px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition",
                  filterOpen
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100",
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>絞り込み</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    filterOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
          </div>

          {/* 絞り込みパネル */}
          {filterOpen && (
            <div
              id="notification-filter-panel"
              className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Filter className="w-3.5 h-3.5 text-emerald-600" />
                  <span>表示カテゴリの選択</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActive(new Set(INBOX_CATEGORIES))}
                    className="text-emerald-700 hover:underline font-semibold"
                  >
                    すべて選択
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setActive(new Set())}
                    className="text-slate-500 hover:underline"
                  >
                    クリア
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {INBOX_CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className="flex items-center justify-between gap-2.5 p-3 min-h-[44px] rounded-xl bg-white border border-slate-200 hover:border-emerald-500/50 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={active.has(category)}
                        onChange={() => toggleCategory(category)}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                      />
                      <span className="font-bold text-slate-800 text-xs truncate">
                        {CATEGORY_LABEL[category]}
                      </span>
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {counts[category]}件
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 通知リスト */}
          <div className="p-4 sm:p-5">
            {visible.length === 0 ? (
              <EmptyState filtered={notifications.length > 0} />
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {visible.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={() => markRead(n)}
                    onOpenMemberEditor={() => openMemberEditor(n)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {editTarget && (
        <EditMembersModal
          entry={editTarget}
          viewer={viewer}
          onClose={() => setEditTarget(null)}
          onDone={(message) => {
            setEditTarget(null);
            showToast(message, "success");
            refresh();
          }}
          onToast={showToast}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="py-12 text-center text-slate-400">
      {filtered ? (
        <>
          <FilterX className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-bold text-slate-600 text-sm">
            該当する通知はありません
          </p>
          <p className="text-xs mt-1">
            「絞り込み」ボタンからカテゴリを選択してください
          </p>
        </>
      ) : (
        <>
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-bold text-slate-600 text-sm">
            通知はまだありません
          </p>
        </>
      )}
    </div>
  );
}

function NotificationItem({
  notification: n,
  onMarkRead,
  onOpenMemberEditor,
}: {
  notification: InboxNotification;
  onMarkRead: () => void;
  onOpenMemberEditor: () => void;
}) {
  const unread = !n.isRead && !n.resolvedAt;
  const isPending = n.kind === "MEMBER_PENDING";

  const iconClass = isPending
    ? n.resolvedAt
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700"
    : "bg-sky-100 text-sky-700";
  const Icon = isPending
    ? n.resolvedAt
      ? CheckCircle2
      : AlertTriangle
    : CalendarClock;

  return (
    <li className={cn("py-3.5 first:pt-0 last:pb-0", unread && "bg-emerald-50/40 -mx-4 sm:-mx-5 px-4 sm:px-5")}>
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
            iconClass,
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-sm text-slate-900 truncate",
                unread ? "font-extrabold" : "font-bold",
              )}
            >
              {n.title}
            </span>
            {unread && (
              <span
                className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                aria-label="未読"
              />
            )}
          </div>
          <p className="text-slate-600 mt-1 leading-relaxed text-xs">{n.body}</p>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 tabular-nums">
              {formatDateTime(n.createdAt)}
            </span>

            {isPending && n.resolvedAt && (
              <span className="text-xs font-bold text-emerald-700">対応済み</span>
            )}

            {isPending && !n.resolvedAt && (
              <button
                type="button"
                onClick={onOpenMemberEditor}
                className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
              >
                メンバー指定
              </button>
            )}

            {!isPending && (
              <Link
                href="/tournaments"
                onClick={onMarkRead}
                className="min-h-[44px] px-4 inline-flex items-center rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                大会日程を確認
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
