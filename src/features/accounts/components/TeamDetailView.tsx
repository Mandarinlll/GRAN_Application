// チーム詳細（メンバー・有効エントリー・承認待ち招待）と、除名・解散の操作。
"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, UserMinus } from "lucide-react";
import { TeamAvatar } from "@/features/teams/components/TeamAvatar";
import type { TeamDetail, TeamMemberRow } from "@/features/accounts/types/account";
import { OperationDialog } from "./OperationDialog";

const sectionClass = "space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6";
const emptyClass = "rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-600";
const dangerButton =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-rose-600 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2";

export function TeamDetailView({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<TeamMemberRow | null>(null);
  const [disbandOpen, setDisbandOpen] = useState(false);
  const closeRemove = useCallback(() => setRemoveTarget(null), []);
  const closeDisband = useCallback(() => setDisbandOpen(false), []);
  // 解散成功後は存在しないチームの詳細を再描画しないよう、一覧へ移動する。
  const onDisbanded = useCallback(() => router.replace("/admin/teams"), [router]);
  const disbandConfirm = useMemo(
    () => ({ label: "確認のためチーム名を入力してください", bodyKey: "confirmName", hint: team.name }),
    [team.name],
  );

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <div className="flex flex-wrap items-center gap-4">
          <TeamAvatar teamId={team.id} name={team.name} avatarKey={team.avatarKey} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="break-all text-lg font-bold text-slate-900">{team.name}</h2>
            <p className="text-sm text-slate-600">
              代表者: {team.leaderRealName}（{team.leaderNickname}）
            </p>
            <p className="text-sm text-slate-600 tabular-nums">作成日時: {team.createdAt.slice(0, 16)}</p>
          </div>
          <button type="button" onClick={() => setDisbandOpen(true)} className={dangerButton}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            チームを解散
          </button>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="team-members">
        <h2 id="team-members" className="text-base font-bold text-slate-900">
          メンバー（<span className="tabular-nums">{team.members.length}</span>名）
        </h2>
        {team.members.length === 0 ? (
          <p className={emptyClass}>メンバーがいません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link
                    href={`/admin/users/${m.userId}`}
                    className="inline-flex min-h-[44px] items-center break-all font-medium text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {m.realName}（{m.nickname}）
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {m.loginId} ／ Gran Level {m.granLevel}
                    {m.isLeader ? " ／ 代表者" : m.joinedAt ? ` ／ 加入 ${m.joinedAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                {m.isLeader ? null : (
                  <button type="button" onClick={() => setRemoveTarget(m)} className={dangerButton}>
                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                    除名
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass} aria-labelledby="team-entries">
        <h2 id="team-entries" className="text-base font-bold text-slate-900">
          有効なエントリー
        </h2>
        {team.activeEntries.length === 0 ? (
          <p className={emptyClass}>有効なエントリーはありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.activeEntries.map((e) => (
              <li key={e.entryId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="break-all font-medium text-slate-900">{e.tournamentName}</span>
                <span className="text-slate-600 tabular-nums">
                  {e.eventDate} ／ {e.status === "CONFIRMED" ? "確定" : "キャンセル待ち"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass} aria-labelledby="team-invitations">
        <h2 id="team-invitations" className="text-base font-bold text-slate-900">
          承認待ちの招待
        </h2>
        {team.pendingInvitations.length === 0 ? (
          <p className={emptyClass}>承認待ちの招待はありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.pendingInvitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="break-all font-medium text-slate-900">{i.inviteeNickname}</span>
                <span className="text-slate-600 tabular-nums">招待日時 {i.createdAt.slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OperationDialog
        open={removeTarget !== null}
        targetName={removeTarget ? `${removeTarget.realName}（${removeTarget.nickname}）` : ""}
        operationLabel="メンバーの除名"
        description={`「${team.name}」から除名します。対象者には通知されます。`}
        confirmLabel="除名する"
        variant="destructive"
        method="DELETE"
        url={removeTarget ? `/api/admin/teams/${team.id}/members/${removeTarget.userId}` : ""}
        successMessage="メンバーを除名しました"
        onClose={closeRemove}
      />
      <OperationDialog
        open={disbandOpen}
        targetName={team.name}
        operationLabel="チームの解散"
        description="チームと過去のエントリー・戦績を削除します。この操作は取り消せません。"
        confirmLabel="解散する"
        variant="destructive"
        method="DELETE"
        url={`/api/admin/teams/${team.id}`}
        confirm={disbandConfirm}
        successMessage="チームを解散しました"
        onSuccess={onDisbanded}
        onClose={closeDisband}
      />
    </div>
  );
}
