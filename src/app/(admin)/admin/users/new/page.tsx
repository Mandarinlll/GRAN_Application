// アカウント作成（URL: /admin/users/new）。accounts.manage を持つ ADMIN のみ。
import { requireAdminPage } from "@/features/admin/server/guard";
import { AccountsTabs } from "@/features/accounts/components/AccountsTabs";
import { CreateUserForm } from "@/features/accounts/components/CreateUserForm";

export const dynamic = "force-dynamic";

export default async function AdminUserNewPage() {
  await requireAdminPage("accounts.manage");
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">アカウント作成</h1>
      <AccountsTabs active="users" />
      <CreateUserForm />
    </div>
  );
}
