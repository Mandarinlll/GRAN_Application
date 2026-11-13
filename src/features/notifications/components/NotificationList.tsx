// 通知一覧（クライアント）。種別フィルター・既読化・該当画面への導線を担う。
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, CheckCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/server/actions";
import type {
  InboxKind,
  InboxNotification,
} from "@/features/notifications/types/notification";

type Filter = "all" | "action" | "reminder";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "action", label: "要対応" },
  { id: "reminder", label: "リマインド" },
];

const KIND_ICON: Record<InboxKind, typeof Bell> = {
  REMINDER_7DAYS: CalendarClock,
  MEMBER_ASSIGN: Users,
};

// "YYYY-MM-DD HH:MM:SS" → "M/D HH:MM"。
function formatReceivedAt(value: string): string {
  const [date, time = ""] = value.split(" ");
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)} ${time.slice(0, 5)}`;
}

function matches(n: InboxNotification, filter: Filter): boolean {
  if (filter === "action") return n.kind === "MEMBER_ASSIGN";
  if (filter === "reminder") return n.kind === "REMINDER_7DAYS";
  return true;
}

export function NotificationList({
  notifications,
}: {
  notifications: InboxNotification[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  const visible = notifications.filter((n) => matches(n, filter));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function readAndRefresh(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function readAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="通知の絞り込み"
          className="flex gap-1.5"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-[44px] px-4 rounded-xl text-xs font-bold border transition",
                filter === f.id
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={readAll}
          disabled={unreadCount === 0 || pending}
          className="min-h-[44px] px-4 rounded-xl text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:text-slate-400 disabled:hover:bg-transparent inline-flex items-center gap-1.5 transition"
        >
          <CheckCheck className="w-4 h-4" />
          すべて既読にする
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center text-center gap-2 shadow-sm">
          <Bell className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">
            該当する通知はありません
          </p>
        </div>
      ) : (
        <ul className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {visible.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              onRead={() => readAndRefresh(n.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationItem({
  n,
  onRead,
}: {
  n: InboxNotification;
  onRead: () => void;
}) {
  const Icon = KIND_ICON[n.kind];
  const needsAction = n.kind === "MEMBER_ASSIGN" && !n.isResolved;
  return (
    <li
      className={cn(
        "p-4 flex items-start gap-3.5",
        !n.isRead && "bg-emerald-50/40",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          needsAction
            ? "bg-rose-100 text-rose-600"
            : "bg-emerald-100 text-emerald-700",
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {!n.isRead && (
            <span
              className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
              aria-label="未読"
            />
          )}
          <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
          <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
            {formatReceivedAt(n.createdAt)}
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{n.body}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {needsAction && n.entryId && (
            <Link
              href={`/tournaments?editEntry=${encodeURIComponent(n.entryId)}`}
              onClick={onRead}
              className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center transition"
            >
              メンバーを指定する
            </Link>
          )}
          {n.kind === "MEMBER_ASSIGN" && n.isResolved && (
            <span className="text-xs font-bold text-emerald-700">
              対応済み
            </span>
          )}
          {n.kind === "REMINDER_7DAYS" && (
            <Link
              href="/tournaments"
              onClick={onRead}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold inline-flex items-center transition"
            >
              大会情報を確認
            </Link>
          )}
          {!n.isRead && (
            <button
              type="button"
              onClick={onRead}
              className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
            >
              既読にする
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
