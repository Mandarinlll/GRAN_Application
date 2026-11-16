// 「マイチーム」入口（URL: /team/mine）。
// 代表者なら所属チームの確認・編集画面へ、代表者でなければ新規作成ページへ振り分ける。
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findLeaderTeamId } from "@/features/teams/server/teamPageRepository";

export default async function MyTeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const teamId = findLeaderTeamId(session.sub);
  redirect(teamId ? `/team/${teamId}/edit` : "/team/new");
}
