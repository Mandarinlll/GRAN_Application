// 大会詳細（URL: /admin/tournaments/{id}）。ADMIN / OPERATOR が閲覧可能。操作要素は ADMIN のみ。
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/server/guard";
import { roleHasPermission } from "@/features/admin/utils/permissions";
import {
  findAdminTournamentById,
  getAdminTournamentStats,
} from "@/features/tournaments/server/tournamentAdminRepository";
import { TournamentDetailView } from "@/features/tournaments/components/admin/TournamentDetailView";
import { nowJstString } from "@/features/topics/utils/topicStatus";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminPage("entries.view");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const tournament = findAdminTournamentById(id);
  if (!tournament) notFound();

  return (
    <TournamentDetailView
      tournament={tournament}
      stats={getAdminTournamentStats(id)}
      nowJst={nowJstString()}
      canManage={roleHasPermission(admin.role, "tournaments.manage")}
    />
  );
}
