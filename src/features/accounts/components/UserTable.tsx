// ユーザー一覧のテーブル・ページ送り・0 件メッセージ。ロック中/停止中はアイコン + テキストで示す（色だけに頼らない）。
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Ban } from "lucide-react";
import type { UserListRow } from "../types/account";
import { PAGE_SIZE, pageRange, type UserListQuery } from "../utils/listQuery";
import { displayOrUnset, formatDisplayRange } from "../utils/format";
import { UnlockUserButton } from "./UnlockUserButton";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理者",
  OPERATOR: "運営",
  LEADER: "チーム代表",
  USER: "一般",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "有効",
  SUSPENDED: "停止中",
  PROVISIONAL: "仮登録",
};

function pageHref(query: UserListQuery, page: number): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.role) p.set("role", query.role);
  if (query.status) p.set("status", query.status);
  if (query.declaredClass) p.set("declaredClass", query.declaredClass);
  if (query.lockedOnly) p.set("locked", "1");
  if (query.uncalibratedOnly) p.set("uncalibrated", "1");
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export function hasActiveFilters(q: UserListQuery): boolean {
  return Boolean(q.q || q.role || q.status || q.declaredClass || q.lockedOnly || q.uncalibratedOnly);
}

const linkClass =
  "inline-flex min-h-[44px] items-center text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

function StateBadges({ row }: { row: UserListRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.locked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
          <Lock className="h-3 w-3" aria-hidden="true" />
          ロック中
        </span>
      )}
      {row.status === "SUSPENDED" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
          <Ban className="h-3 w-3" aria-hidden="true" />
          停止中
        </span>
      )}
      {row.status === "PROVISIONAL" && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">仮登録</span>
      )}
    </div>
  );
}

export function UserTable({
  rows,
  total,
  page,
  query,
}: {
  rows: UserListRow[];
  total: number;
  page: number;
  query: UserListQuery;
}) {
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-800">
          {hasActiveFilters(query) ? "条件に一致するユーザーはいません。" : "ユーザーが登録されていません。"}
        </p>
        {hasActiveFilters(query) && (
          <Link
            href="/admin/users"
            className="mt-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-emerald-600 bg-white px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            条件を解除
          </Link>
        )}
      </div>
    );
  }

  const { from, to, pages } = pageRange(total, page);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 tabular-nums" aria-live="polite">
        全 {total} 件中 {formatDisplayRange(from, to)}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-3">ユーザーID</th>
              <th scope="col" className="px-3 py-3">氏名</th>
              <th scope="col" className="px-3 py-3">ニックネーム</th>
              <th scope="col" className="px-3 py-3">メールアドレス</th>
              <th scope="col" className="px-3 py-3">権限</th>
              <th scope="col" className="px-3 py-3">状態</th>
              <th scope="col" className="px-3 py-3 text-right">Gran レベル</th>
              <th scope="col" className="px-3 py-3">申告クラス</th>
              <th scope="col" className="px-3 py-3">査定</th>
              <th scope="col" className="px-3 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-1 tabular-nums">
                  <Link href={`/admin/users/${r.id}`} className={`${linkClass} font-medium`}>
                    {r.loginId}
                  </Link>
                </td>
                <td className="px-3 py-1">
                  <Link href={`/admin/users/${r.id}`} className={linkClass}>
                    {r.realName}
                  </Link>
                </td>
                <td className="px-3 py-1">{r.nickname}</td>
                <td className="px-3 py-1 break-all">{r.email}</td>
                <td className="px-3 py-1">{ROLE_LABEL[r.role] ?? r.role}</td>
                <td className="px-3 py-1">
                  <div className="space-y-1">
                    <span>{STATUS_LABEL[r.status] ?? r.status}</span>
                    <StateBadges row={r} />
                  </div>
                </td>
                <td className="px-3 py-1 text-right tabular-nums">{r.granLevel}</td>
                <td className="px-3 py-1">{displayOrUnset(r.declaredClass)}</td>
                <td className="px-3 py-1">{r.isLevelCalibrated ? "査定済" : "未査定"}</td>
                <td className="px-3 py-1">
                  {r.locked && (
                    <UnlockUserButton userId={r.id} targetName={`${r.realName}（${r.loginId}）`} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <nav aria-label="ページ送り" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(query, page - 1)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              前へ
            </Link>
          ) : (
            <span aria-hidden="true" className="min-h-[44px] min-w-[44px]" />
          )}
          <span className="text-sm text-slate-600 tabular-nums">
            {page} / {pages} ページ
          </span>
          {page < pages ? (
            <Link
              href={pageHref(query, page + 1)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              次へ
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span aria-hidden="true" className="min-h-[44px] min-w-[44px]" />
          )}
        </nav>
      )}
    </div>
  );
}
