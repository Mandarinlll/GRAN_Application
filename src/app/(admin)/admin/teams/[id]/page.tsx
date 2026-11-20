// チーム詳細（URL: /admin/teams/{id}）。accounts.manage 権限が必要。
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdminPage } from "@/features/admin/server/guard";
import { TeamDetailView } from "@/features/accounts/components/TeamDetailView";
import { getTeamDetail } from "@/features/accounts/server/teamQueryService";

export const dynamic = "force-dynamic";

export default async function AdminTeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("accounts.manage");
  const { id } = await params;
  const result = await getTeamDetail(id);
  if (!result.ok && result.code === "NOT_FOUND") notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/teams"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        チーム一覧へ
      </Link>
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">チーム詳細</h1>
      {result.ok ? (
        <TeamDetailView team={result.data} />
      ) : (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {result.message}
        </p>
      )}
    </div>
  );
}
