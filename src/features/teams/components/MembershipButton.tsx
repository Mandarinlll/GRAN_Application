// 参加リクエスト送信 / 取り下げ / 脱退のボタン（クライアント）。
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelJoinRequestAction,
  leaveTeamAction,
  requestJoinAction,
} from "@/features/teams/server/actions";

// none: 未所属で申請可 / pending: 申請中 / member: 所属中 / leader: 代表者 / blocked: 他チーム所属
export type MembershipState = "none" | "pending" | "member" | "leader" | "blocked";

const BASE =
  "min-h-[44px] px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center transition disabled:opacity-60";

export function MembershipButton({
  teamId,
  state,
}: {
  teamId: string;
  state: MembershipState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action(teamId);
      if (!res.ok) setError(res.message ?? "処理に失敗しました。");
      router.refresh();
    });
  }

  if (state === "leader") {
    return <span className="text-xs font-bold text-emerald-700">代表者</span>;
  }
  if (state === "blocked") {
    return <span className="text-xs text-slate-500">他チームに所属中</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {state === "none" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(requestJoinAction)}
          className={`${BASE} bg-emerald-600 hover:bg-emerald-700 text-white`}
        >
          参加リクエストを送る
        </button>
      )}
      {state === "pending" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(cancelJoinRequestAction)}
          className={`${BASE} border border-slate-200 text-slate-700 hover:bg-slate-50`}
        >
          承認待ち（取り下げ）
        </button>
      )}
      {state === "member" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("このチームから脱退しますか？")) run(leaveTeamAction);
          }}
          className={`${BASE} border border-rose-200 text-rose-600 hover:bg-rose-50`}
        >
          脱退する
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
