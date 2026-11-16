// チーム名の入力フォーム（新規作成 / 名称編集）と、チーム解散ボタン（クライアント）。
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTeamAction,
  deleteTeamAction,
  renameTeamAction,
} from "@/features/teams/server/actions";

const INPUT =
  "w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900";
const PRIMARY =
  "min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60";

export function TeamNameForm({
  mode,
  teamId,
  initialName = "",
}: {
  mode: "create" | "edit";
  teamId?: string;
  initialName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      if (mode === "create") {
        const res = await createTeamAction(name);
        if (res.ok && res.teamId) {
          router.push(`/team/${res.teamId}/edit`);
          router.refresh();
          return;
        }
        setMessage({ ok: false, text: res.message ?? "作成に失敗しました。" });
      } else {
        const res = await renameTeamAction(teamId, name);
        if (res.ok) {
          // 保存後はチーム詳細画面へ遷移する。
          router.push(`/team/${teamId}`);
          router.refresh();
          return;
        }
        setMessage({ ok: false, text: res.message ?? "保存に失敗しました。" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1 text-xs font-bold text-slate-600">
        チーム名（15文字以内）
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={15}
          required
          className={INPUT}
        />
      </label>
      <button type="submit" disabled={pending} className={PRIMARY}>
        {mode === "create" ? "チームを作成" : "保存"}
      </button>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-xs text-emerald-700" : "text-xs text-rose-600"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

// 解散は取り消せないため、チーム名の入力による確認を必須にする。
export function DeleteTeamPanel({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteTeamAction(teamId);
      if (!res.ok) {
        setError(res.message ?? "削除に失敗しました。");
        return;
      }
      router.push("/team");
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-xl border border-rose-200 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-rose-700">チームを解散する</h2>
      <p className="text-xs text-slate-600 leading-relaxed">
        チーム、所属メンバー、大会エントリー、戦績をすべて削除します。この操作は取り消せません。
        続けるには、チーム名「{teamName}」を入力してください。
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        aria-label="確認のためチーム名を入力"
        className={INPUT}
      />
      <button
        type="button"
        disabled={pending || confirmText !== teamName}
        onClick={remove}
        className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
      >
        解散する
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
