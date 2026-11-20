// ユーザー一覧（URL: /admin/users）。accounts.manage を持つ ADMIN のみ。
import { requireAdminPage } from "@/features/admin/server/guard";
import { listUsers } from "@/features/accounts/server/userQueryService";
import { AccountsTabs } from "@/features/accounts/components/AccountsTabs";
import { UserFilters } from "@/features/accounts/components/UserFilters";
import { UserTable } from "@/features/accounts/components/UserTable";
import { parseUserListQuery, type SearchParams, type UserListQuery } from "@/features/accounts/utils/listQuery";

export const dynamic = "force-dynamic";

const UNFILTERED: UserListQuery = { lockedOnly: false, uncalibratedOnly: false, page: 1 };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage("accounts.manage");
  const sp = await searchParams;
  const parsed = parseUserListQuery(sp);

  // 検索語が長すぎる場合はエラーを表示し、条件なしの一覧を描画する（入力値は保持）
  const query = parsed.ok ? parsed.query : UNFILTERED;
  const searchError = parsed.ok ? null : parsed.error;
  const rawQ = Array.isArray(sp.q) ? (sp.q[0] ?? "") : (sp.q ?? "");

  const result = await listUsers(query);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-24">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">ユーザー・チーム管理</h1>
      <AccountsTabs active="users" />
      <UserFilters query={query} rawSearch={rawQ} searchError={searchError} />
      {result.ok ? (
        <UserTable rows={result.data.rows} total={result.data.total} page={result.data.page} query={query} />
      ) : (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          ユーザー一覧を取得できませんでした。{result.message}
        </p>
      )}
    </div>
  );
}
