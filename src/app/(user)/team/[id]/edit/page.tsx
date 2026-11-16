// チーム情報の確認・編集ページ（URL: /team/[id]/edit）。代表者のみ。
// チーム名・アイコンの編集と、チーム解散を行う。
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getTeamPageContext } from "@/features/teams/server/pageContext";
import {
  getTeamDetail,
  listPendingInvitations,
} from "@/features/teams/server/teamPageRepository";
import { TeamAvatar } from "@/features/teams/components/TeamAvatar";
import { AvatarUploader } from "@/features/teams/components/AvatarUploader";
import { MemberManager } from "@/features/teams/components/MemberManager";
import { InvitePanel } from "@/features/teams/components/InvitePanel";
import { DeleteTeamPanel, TeamNameForm } from "@/features/teams/components/TeamForm";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getTeamPageContext();
  if (!ctx) redirect("/login");

  const { id } = await params;
  const team = getTeamDetail(id);
  if (!team) notFound();
  // 代表者以外は閲覧用の詳細ページへ。
  if (team.leaderUserId !== ctx.userId) redirect(`/team/${id}`);

  return (
    <AppShell activeId="team" user={ctx.shellUser}>
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <Link
          href="/team"
          className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          チーム一覧へ
        </Link>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">マイチーム</h1>
            <Link
              href={`/team/${team.id}`}
              className="min-h-[44px] inline-flex items-center text-xs font-bold text-emerald-700 hover:underline"
            >
              公開ページを見る
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <TeamAvatar teamId={team.id} name={team.name} avatarKey={team.avatarKey} size="lg" />
            <AvatarUploader teamId={team.id} hasAvatar={team.avatarKey !== null} />
          </div>
          <TeamNameForm mode="edit" teamId={team.id} initialName={team.name} />
          <p className="text-xs text-slate-500">
            所属メンバー {team.members.length}名 ・ 平均Rate {team.averageGranLevel ?? "-"}
          </p>
        </section>

        <MemberManager teamId={team.id} members={team.members} />

        <InvitePanel teamId={team.id} invitations={listPendingInvitations(team.id)} />

        <DeleteTeamPanel teamId={team.id} teamName={team.name} />
      </main>
    </AppShell>
  );
}
