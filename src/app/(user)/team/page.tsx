// チーム一覧ページ（URL: /team）。種目・階級で絞り込み、チーム詳細へ移動できる。
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamList } from "@/features/teams/components/TeamList";
import { getTeamPageContext } from "@/features/teams/server/pageContext";
import { findLeaderTeamId, listTeams } from "@/features/teams/server/teamPageRepository";

export default async function TeamPage() {
  const ctx = await getTeamPageContext();
  if (!ctx) redirect("/login");

  return (
    <AppShell activeId="team" user={ctx.shellUser}>
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <PageHeader
          icon={Users}
          title="チーム"
          action={
            // 代表者ならマイチームの編集画面、そうでなければ新規作成ページへ（/team/mine で振り分け）。
            <Link
              href="/team/mine"
              className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center transition"
            >
              {findLeaderTeamId(ctx.userId) ? "マイチームを管理" : "チームを作成"}
            </Link>
          }
        />
        <TeamList
          teams={listTeams()}
          userId={ctx.userId}
          myTeamIds={ctx.myTeamIds}
        />
      </main>
    </AppShell>
  );
}
