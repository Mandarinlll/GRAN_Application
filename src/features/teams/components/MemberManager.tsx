// 代表者向け: 所属メンバー一覧と除名ボタン（クライアント）。
// 入れ替えは「除名 → 新しいユーザーを招待」で行う。
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMemberAction } from "@/features/teams/server/actions";

export function MemberManager({
  teamId,
  members,
}: {
  teamId: string;
  members: Array<{ userId: string; nickname: string; granLevel: number; isLeader: boolean }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(userId: string, nickname: string) {
    if (!window.confirm(`${nickname} さんをチームから除名しますか？`)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeMemberAction(teamId, userId);
      if (!res.ok) setError(res.message ?? "除名に失敗しました。");
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-slate-900">メンバー管理（{members.length}名）</h2>
      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.userId} className="py-2 flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800 truncate">{m.nickname}</span>
            {m.isLeader && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                代表者
              </span>
            )}
            <span className="ml-auto text-xs text-slate-500 tabular-nums">Rate {m.granLevel}</span>
            {!m.isLeader && (
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(m.userId, m.nickname)}
                className="min-h-[44px] px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold disabled:opacity-60"
              >
                除名
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}