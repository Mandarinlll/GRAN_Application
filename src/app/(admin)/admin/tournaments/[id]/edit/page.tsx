// 大会の編集（URL: /admin/tournaments/{id}/edit）。ADMIN のみ。
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/server/guard";
import {
  countConfirmed,
  findAdminTournamentById,
} from "@/features/tournaments/server/tournamentAdminRepository";
import { TournamentForm } from "@/features/tournaments/components/admin/TournamentForm";
import { toFormValues } from "@/features/tournaments/components/admin/formValues";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("tournaments.manage");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const tournament = findAdminTournamentById(id);
  if (!tournament) notFound();

  const locked = tournament.status === "FINISHED" || tournament.status === "CANCELLED";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <h1 className="text-lg font-bold text-slate-900">大会を編集</h1>
      <TournamentForm
        mode="edit"
        tournamentId={tournament.id}
        expectedUpdatedAt={tournament.updatedAt}
        initialValues={toFormValues(tournament)}
        existingImageUrl={tournament.imageUrl}
        confirmedCount={countConfirmed(tournament.id)}
        lockedFields={locked}
        cancelHref={`/admin/tournaments/${tournament.id}`}
      />
    </div>
  );
}
