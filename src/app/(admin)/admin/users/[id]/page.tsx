// ユーザー詳細（URL: /admin/users/{id}）。accounts.manage 権限が必要。
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdminPage } from "@/features/admin/server/guard";
import { UserDetailView } from "@/features/accounts/components/UserDetailView";
import { getUserDetail } from "@/features/accounts/server/userQueryService";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("accounts.manage");
  const { id } = await params;
  const result = await getUserDetail(id);
  if (!result.ok && result.code === "NOT_FOUND") notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <Link
        href="/admin/users"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        ユーザー一覧へ
      </Link>
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">ユーザー詳細</h1>
      {result.ok ? (
        <UserDetailView user={result.data} />
      ) : (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {result.message}
        </p>
      )}
    </div>
  );
}
