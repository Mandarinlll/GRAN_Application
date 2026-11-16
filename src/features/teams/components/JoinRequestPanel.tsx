// 代表者向け: 承認待ちの参加リクエスト一覧と承認・却下ボタン（クライアント）。
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveJoinRequestAction } from "@/features/teams/server/actions";
import type { JoinRequestView } from "@/features/teams/types/team";

export function JoinRequestPanel({ requests }: { requests: JoinRequestView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve(id: string, approve: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await resolveJoinRequestAction(id, approve);
      if (!res.ok) setError(res.message ?? "処理に失敗しました。");
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-slate-900">
        参加リクエスト（{requests.length}件）
      </h2>
      {requests.length === 0 ? (
        <p className="text-xs text-slate-500">承認待ちのリクエストはありません。</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {requests.map((r) => (
            <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate">
                  {r.nickname}
                </div>
                <div className="text-xs text-slate-500">
                  Rate {r.granLevel} ・ {r.createdAt.slice(0, 16)}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => resolve(r.id, true)}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
              >
                承認
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => resolve(r.id, false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold disabled:opacity-60"
              >
                却下
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
