// 通知の詳細（クライアント）。通知ごとの操作（招待への応答・該当画面への移動）はここでのみ行う。
// 既読化は、詳細画面を開いた時点でサーバー側で行う。
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { respondInvitationAction } from "@/features/teams/server/actions";
import type { InboxNotification } from "@/features/notifications/types/notification";
import {
  KIND_ICON,
  KIND_LABEL,
  formatReceivedAt,
  needsAction,
} from "@/features/notifications/utils/display";

const PRIMARY =
  "min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center disabled:opacity-60 transition";
const SECONDARY =
  "min-h-[44px] px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold inline-flex items-center disabled:opacity-60 transition";

export function NotificationDetail({ n }: { n: InboxNotification }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const Icon = KIND_ICON[n.kind];
  const action = needsAction(n);

  function respond(accept: boolean) {
    if (!n.refId) return;
    const invitationId = n.refId;
    setError(null);
    startTransition(async () => {
      const res = await respondInvitationAction(invitationId, accept);
      if (!res.ok) {
        setError(res.message ?? "処理に失敗しました。");
        router.refresh();
        return;
      }
      if (accept && res.teamId) router.push(`/team/${res.teamId}`);
      else router.refresh();
    });
  }

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            action ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-700",
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{KIND_LABEL[n.kind]}</p>
          <h1 className="text-lg font-bold text-slate-900">{n.title}</h1>
        </div>
        <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
          {formatReceivedAt(n.createdAt)}
        </span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{n.body}</p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {n.kind === "TEAM_INVITE" &&
          (action ? (
            <>
              <button type="button" disabled={busy} onClick={() => respond(true)} className={PRIMARY}>
                参加する
              </button>
              <button type="button" disabled={busy} onClick={() => respond(false)} className={SECONDARY}>
                辞退する
              </button>
            </>
          ) : (
            <span className="text-xs font-bold text-emerald-700">対応済み</span>
          ))}

        {n.kind === "MEMBER_ASSIGN" &&
          (action && n.entryId ? (
            <Link href={`/tournaments?editEntry=${encodeURIComponent(n.entryId)}`} className={PRIMARY}>
              メンバーを指定する
            </Link>
          ) : (
            <span className="text-xs font-bold text-emerald-700">対応済み</span>
          ))}

        {n.kind === "REMINDER_7DAYS" && (
          <Link href="/tournaments" className={SECONDARY}>
            大会情報を確認
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </article>
  );
}
