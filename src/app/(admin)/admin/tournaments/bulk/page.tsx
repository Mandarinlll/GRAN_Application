// 大会の一括登録（URL: /admin/tournaments/bulk）。ADMIN のみ。
import { requireAdminPage } from "@/features/admin/server/guard";
import { BulkRegistrationForm } from "./BulkRegistrationForm";

export default async function AdminTournamentsBulkPage() {
  await requireAdminPage("tournaments.manage");
  return <BulkRegistrationForm />;
}
