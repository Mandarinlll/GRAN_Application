// ユーザー一覧の絞り込みフォーム。GET で送信し、条件は URL の searchParams に持つ（送信時は 1 ページ目に戻る）。
import Link from "next/link";
import { Search } from "lucide-react";
import type { UserListQuery } from "../utils/listQuery";
import { MAX_SEARCH_LENGTH } from "../utils/listQuery";

const ROLE_OPTIONS = [
  ["ADMIN", "管理者"],
  ["OPERATOR", "運営"],
  ["LEADER", "チーム代表"],
  ["USER", "一般"],
] as const;
const STATUS_OPTIONS = [
  ["ACTIVE", "有効"],
  ["SUSPENDED", "停止中"],
  ["PROVISIONAL", "仮登録"],
] as const;
const CLASS_OPTIONS = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"] as const;

const fieldClass =
  "block min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export function UserFilters({
  query,
  rawSearch,
  searchError,
}: {
  query: UserListQuery;
  /** 検索語エラー時にも入力値を保持するための生の値 */
  rawSearch: string;
  searchError: string | null;
}) {
  return (
    <form method="get" action="/admin/users" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <label htmlFor="user-q" className="block text-sm font-medium text-slate-800">
          検索
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="user-q"
            name="q"
            type="search"
            defaultValue={rawSearch}
            placeholder="氏名・フリガナ・ニックネーム・メール・ユーザーID"
            aria-invalid={searchError ? true : undefined}
            aria-describedby={searchError ? "user-q-error" : undefined}
            className={`${fieldClass} pl-9`}
          />
        </div>
        <p className="text-[13px] text-slate-600">{MAX_SEARCH_LENGTH}文字以内</p>
        {searchError && (
          <p id="user-q-error" role="alert" className="text-[13px] text-rose-600">
            {searchError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="user-role" className="block text-sm font-medium text-slate-800">
            権限
          </label>
          <select id="user-role" name="role" defaultValue={query.role ?? ""} className={fieldClass}>
            <option value="">すべて</option>
            {ROLE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="user-status" className="block text-sm font-medium text-slate-800">
            状態
          </label>
          <select id="user-status" name="status" defaultValue={query.status ?? ""} className={fieldClass}>
            <option value="">すべて</option>
            {STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="user-class" className="block text-sm font-medium text-slate-800">
            申告クラス
          </label>
          <select id="user-class" name="declaredClass" defaultValue={query.declaredClass ?? ""} className={fieldClass}>
            <option value="">すべて</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            name="locked"
            value="1"
            defaultChecked={query.lockedOnly}
            className="h-5 w-5 accent-emerald-600"
          />
          ロック中のみ
        </label>
        <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            name="uncalibrated"
            value="1"
            defaultChecked={query.uncalibratedOnly}
            className="h-5 w-5 accent-emerald-600"
          />
          未査定のみ
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          絞り込む
        </button>
        <Link
          href="/admin/users"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          条件をクリア
        </Link>
      </div>
    </form>
  );
}
