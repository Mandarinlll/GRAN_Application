// 大会管理 一覧（URL: /admin/tournaments）。ADMIN / OPERATOR が閲覧可能。
import { requireAdminPage } from "@/features/admin/server/guard";
import { roleHasPermission } from "@/features/admin/utils/permissions";
import { listAdminTournamentRows } from "@/features/tournaments/server/tournamentAdminRepository";
import { TournamentListView } from "@/components/admin/TournamentListView";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const admin = await requireAdminPage("entries.view");
  return (
    <TournamentListView
      rows={listAdminTournamentRows()}
      canManage={roleHasPermission(admin.role, "tournaments.manage")}
    />
  );
}
