// チーム新規作成ページ（URL: /team/new）。すでに代表を務めている場合は編集画面へ移動する。
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getTeamPageContext } from "@/features/teams/server/pageContext";
import { findLeaderTeamId } from "@/features/teams/server/teamPageRepository";
import { TeamNameForm } from "@/features/teams/components/TeamForm";

export default async function NewTeamPage() {
  const ctx = await getTeamPageContext();
  if (!ctx) redirect("/login");
  const existing = findLeaderTeamId(ctx.userId);
  if (existing) redirect(`/team/${existing}/edit`);

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
          <h1 className="text-xl font-bold text-slate-900">チームを作成</h1>
          <p className="text-xs text-slate-500">
            作成すると、あなたがこのチームの代表者になります。アイコンは作成後に設定できます。
          </p>
          <TeamNameForm mode="create" />
        </section>
      </main>
    </AppShell>
  );
}
