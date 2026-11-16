// 代表者向け: ユーザーの検索・招待と、招待中ユーザーの一覧（クライアント）。
// 招待すると、相手の通知ページに「チームへの招待」が届く。
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelInvitationAction,
  inviteUserAction,
  searchInviteCandidatesAction,
} from "@/features/teams/server/actions";
import type { InvitationView, InviteCandidate } from "@/features/teams/types/team";

const BTN = "min-h-[44px] px-4 rounded-xl text-xs font-bold disabled:opacity-60 transition";

export function InvitePanel({
  teamId,
  invitations,
}: {
  teamId: string;
  invitations: InvitationView[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteCandidate[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      setResults(await searchInviteCandidatesAction(teamId, query));
    });
  }

  function invite(c: InviteCandidate) {
    setMessage(null);
    startTransition(async () => {
      const res = await inviteUserAction(teamId, c.userId);
      if (res.ok) {
        setMessage({ ok: true, text: `${c.nickname} さんに招待を送りました。` });
        setResults((prev) => prev?.filter((r) => r.userId !== c.userId) ?? null);
      } else {
        setMessage({ ok: false, text: res.message ?? "招待に失敗しました。" });
      }
      router.refresh();
    });
  }

  function cancel(id: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await cancelInvitationAction(id);
      if (!res.ok) setMessage({ ok: false, text: res.message ?? "取り消しに失敗しました。" });
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <h2 className="text-sm font-bold text-slate-900">ユーザーを招待</h2>

      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={40}
          placeholder="ニックネームで検索"
          aria-label="招待するユーザーのニックネーム"
          className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
        />
        <button
          type="submit"
          disabled={pending || query.trim() === ""}
          className={`${BTN} bg-emerald-600 hover:bg-emerald-700 text-white`}
        >
          検索
        </button>
      </form>

      {results && (
        results.length === 0 ? (
          <p className="text-xs text-slate-500">該当するユーザーはいません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {results.map((c) => (
              <li key={c.userId} className="py-2 flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800 truncate">{c.nickname}</span>
                <span className="text-xs text-slate-500 tabular-nums">Rate {c.granLevel}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => invite(c)}
                  className={`${BTN} ml-auto border border-emerald-300 text-emerald-700 hover:bg-emerald-50`}
                >
                  招待する
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-xs text-emerald-700" : "text-xs text-rose-600"}
        >
          {message.text}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-600">招待中（{invitations.length}件）</h3>
        {invitations.length === 0 ? (
          <p className="text-xs text-slate-500">招待中のユーザーはいません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invitations.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800 truncate">{i.nickname}</span>
                <span className="text-xs text-slate-500">{i.createdAt.slice(0, 16)}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => cancel(i.id)}
                  className={`${BTN} ml-auto border border-slate-200 text-slate-700 hover:bg-slate-50`}
                >
                  取り消し
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}