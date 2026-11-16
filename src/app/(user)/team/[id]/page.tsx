// チーム詳細ページ（URL: /team/[id]）。
// チーム名・代表者・所属メンバー・成績を表示し、参加リクエスト/脱退の操作を提供する。
// 代表者本人には承認待ちリクエストの一覧（承認・却下）も表示する。
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getTeamPageContext } from "@/features/teams/server/pageContext";
import {
  getTeamDetail,
  listPendingRequests,
} from "@/features/teams/server/teamPageRepository";
import { MembershipButton } from "@/features/teams/components/MembershipButton";
import { JoinRequestPanel } from "@/features/teams/components/JoinRequestPanel";
import { membershipStateFor } from "@/features/teams/utils/membership";
import {
  CategoryBadge,
  TierBadge,
} from "@/features/tournaments/components/badges";

const RANK_LABEL = {
  T1_WINNER: "優勝",
  T1_RUNNER_UP: "準優勝",
  L2_WINNER: "2位トーナメント優勝",
  PARTICIPATED: "参加",
} as const;

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getTeamPageContext();
  if (!ctx) redirect("/login");

  const { id } = await params;
  const team = getTeamDetail(id);
  if (!team) notFound();

  const state = membershipStateFor({
    teamId: team.id,
    leaderUserId: team.leaderUserId,
    userId: ctx.userId,
    myTeamId: ctx.myTeamId,
    pendingTeamIds: ctx.pendingTeamIds,
  });
  const requests = state === "leader" ? listPendingRequests(team.id) : null;

  return (
    <AppShell activeId="team" user={ctx.shellUser}>
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-4">
        <Link
          href="/team"
          className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          チーム一覧へ
        </Link>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h1 className="text-xl font-bold text-slate-900">{team.name}</h1>
          <div className="text-xs text-slate-500">
            代表者 {team.leaderNickname} ・ {team.members.length}名
            {team.averageGranLevel !== null && ` ・ 平均Rate ${team.averageGranLevel}`}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {team.tier && <TierBadge tier={team.tier} />}
            {team.categories.map((c) => (
              <CategoryBadge key={c} category={c} />
            ))}
          </div>
          <MembershipButton teamId={team.id} state={state} />
        </section>

        {requests && <JoinRequestPanel requests={requests} />}

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">成績</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              ["出場", team.record.participations],
              ["優勝", team.record.titles],
              ["準優勝", team.record.runnerUps],
              ["2位T優勝", team.record.l2Titles],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-lg font-bold text-slate-900 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {team.recentResults.length === 0 ? (
            <p className="text-xs text-slate-500">成績の記録はまだありません。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {team.recentResults.map((r) => (
                <li key={r.tournamentId} className="py-2 flex items-center gap-3 text-xs">
                  <span className="text-slate-400 tabular-nums">{r.eventDate}</span>
                  <span className="flex-1 min-w-0 truncate font-bold text-slate-800">
                    {r.title}
                  </span>
                  <span className="font-bold text-emerald-700">{RANK_LABEL[r.rankType]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">所属メンバー</h2>
          <ul className="divide-y divide-slate-100">
            {team.members.map((m) => (
              <li key={m.userId} className="py-2 flex items-center gap-2 text-sm">
                <span className="font-bold text-slate-800">{m.nickname}</span>
                {m.isLeader && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    代表者
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-500 tabular-nums">
                  Rate {m.granLevel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
