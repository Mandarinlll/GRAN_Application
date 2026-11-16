// 通知一覧（クライアント）。種別フィルターと、各通知の詳細画面への導線のみを担う。
// 既読化・招待への応答・該当画面への移動などの操作は、すべて詳細画面（/notifications/[id]）で行う。
"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxNotification } from "@/features/notifications/types/notification";
import {
  KIND_ICON,
  formatReceivedAt,
  needsAction,
} from "@/features/notifications/utils/display";

type Filter = "all" | "action" | "reminder";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "action", label: "要対応" },
  { id: "reminder", label: "リマインド" },
];

function matches(n: InboxNotification, filter: Filter): boolean {
  if (filter === "action") return n.kind === "MEMBER_ASSIGN" || n.kind === "TEAM_INVITE";
  if (filter === "reminder") return n.kind === "REMINDER_7DAYS";
  return true;
}

export function NotificationList({
  notifications,
}: {
  notifications: InboxNotification[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = notifications.filter((n) => matches(n, filter));

  return (
    <section className="space-y-4">
      <div role="group" aria-label="通知の絞り込み" className="flex gap-1.5">
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

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center text-center gap-2 shadow-sm">
          <Bell className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">該当する通知はありません</p>
        </div>
      ) : (
        <ul className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {visible.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </ul>
      )}
    </section>
  );
}

// 一覧の1行。行全体が詳細画面へのリンクで、操作ボタンは置かない。
function NotificationRow({ n }: { n: InboxNotification }) {
  const Icon = KIND_ICON[n.kind];
  const action = needsAction(n);
  return (
    <li>
      <Link
        href={`/notifications/${encodeURIComponent(n.id)}`}
        className={cn(
          "p-4 flex items-start gap-3.5 hover:bg-slate-50 transition",
          !n.isRead && "bg-emerald-50/40",
        )}
      >
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            action ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-700",
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {!n.isRead && (
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-label="未読" />
            )}
            <h3 className="text-sm font-bold text-slate-900 truncate">{n.title}</h3>
            <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
              {formatReceivedAt(n.createdAt)}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-1">{n.body}</p>
          {action && <span className="text-xs font-bold text-rose-600">要対応</span>}
          {!action && n.kind !== "REMINDER_7DAYS" && n.isResolved && (
            <span className="text-xs font-bold text-emerald-700">対応済み</span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center" />
      </Link>
    </li>
  );
}
