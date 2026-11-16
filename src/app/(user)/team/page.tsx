// チーム一覧ページ（URL: /team）。種目・階級で絞り込み、チームへ参加リクエストを送れる。
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamList } from "@/features/teams/components/TeamList";
import { getTeamPageContext } from "@/features/teams/server/pageContext";
import { listTeams } from "@/features/teams/server/teamPageRepository";

export default async function TeamPage() {
  const ctx = await getTeamPageContext();
  if (!ctx) redirect("/login");

  return (
    <AppShell activeId="team" user={ctx.shellUser}>
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">チーム</h1>
        </div>
        <TeamList
          teams={listTeams()}
          userId={ctx.userId}
          myTeamId={ctx.myTeamId}
          pendingTeamIds={ctx.pendingTeamIds}
        />
      </main>
    </AppShell>
  );
}
