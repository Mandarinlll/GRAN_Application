// チーム詳細画面の脱退ボタン（クライアント）。
// チームへの参加は代表者からの招待のみ（参加リクエスト機能は廃止）。
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveTeamAction } from "@/features/teams/server/actions";

// none: 未所属 / member: 所属中 / leader: 代表者
export type MembershipState = "none" | "member" | "leader";

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

  if (state !== "member") return null;

  function leave() {
    if (!window.confirm("このチームから脱退しますか？")) return;
    setError(null);
    startTransition(async () => {
      const res = await leaveTeamAction(teamId);
      if (!res.ok) setError(res.message ?? "処理に失敗しました。");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={leave}
        className="min-h-[44px] px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center transition disabled:opacity-60 border border-rose-200 text-rose-600 hover:bg-rose-50"
      >
        脱退する
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
