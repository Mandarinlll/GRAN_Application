// チーム一覧（URL: /admin/teams）。accounts.manage 権限が必要。
import { requireAdminPage } from "@/features/admin/server/guard";
import { AccountsTabs } from "@/features/accounts/components/AccountsTabs";
import { TeamTable } from "@/features/accounts/components/TeamTable";
import { listTeams } from "@/features/accounts/server/teamQueryService";
import { parseTeamListQuery, type SearchParams } from "@/features/accounts/utils/listQuery";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage("accounts.manage");
  const sp = await searchParams;
  const parsed = parseTeamListQuery(sp);
  const rawQ = Array.isArray(sp.q) ? (sp.q[0] ?? "") : (sp.q ?? "");
  // 検索語が不正なときは入力値を保持したまま、条件なしで一覧を描画する。
  const query = parsed.ok ? parsed.query : { page: 1 };
  const result = await listTeams(query);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">ユーザー・チーム管理</h1>
      <AccountsTabs active="teams" />
      {result.ok ? (
        <TeamTable
          rows={result.data.rows}
          total={result.data.total}
          page={result.data.page}
          searchTerm={parsed.ok ? (parsed.query.q ?? "") : rawQ}
          searchError={parsed.ok ? undefined : parsed.error}
        />
      ) : (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {result.message}
        </p>
      )}
    </div>
  );
}
