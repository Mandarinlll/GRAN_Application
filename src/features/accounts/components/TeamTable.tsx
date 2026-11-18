// チーム一覧（検索フォーム・テーブル・ページ送り）。URL の searchParams で状態を持つサーバー向け部品。
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { TeamListRow } from "@/features/accounts/types/account";
import { MAX_SEARCH_LENGTH, pageRange } from "@/features/accounts/utils/listQuery";
import { formatDisplayRange } from "@/features/accounts/utils/format";

interface TeamTableProps {
  rows: TeamListRow[];
  total: number;
  page: number;
  /** 検索入力欄に保持する語（検証エラー時は入力されたままの値） */
  searchTerm: string;
  /** 検索語の検証エラー */
  searchError?: string;
}

function pageHref(q: string, page: number): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/admin/teams?${s}` : "/admin/teams";
}

const pagerClass =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
const pagerDisabled = `${pagerClass} pointer-events-none opacity-40`;

export function TeamTable({ rows, total, page, searchTerm, searchError }: TeamTableProps) {
  const { from, to, pages } = pageRange(total, page);
  const q = searchTerm.trim();

  return (
    <section className="space-y-4">
      <form action="/admin/teams" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="team-search" className="sr-only">
          チーム名・代表者名で検索
        </label>
        <input
          id="team-search"
          name="q"
          type="search"
          defaultValue={searchTerm}
          placeholder="チーム名・代表者の氏名／ニックネーム"
          aria-invalid={searchError ? true : undefined}
          aria-describedby={searchError ? "team-search-error" : undefined}
          className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:max-w-md"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          検索
        </button>
      </form>
      {searchError ? (
        <p id="team-search-error" role="alert" className="text-sm text-rose-600">
          {searchError}（最大 {MAX_SEARCH_LENGTH} 文字）
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          {q ? (
            <>
              「<span className="break-all font-medium text-slate-900">{q}</span>」に該当するチームはありません。
            </>
          ) : (
            "チームがありません。"
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600 tabular-nums">
            全 {total} 件中 {formatDisplayRange(from, to)}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">チーム名</th>
                  <th scope="col" className="px-4 py-3 font-medium">代表者</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">メンバー数</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">有効エントリー</th>
                  <th scope="col" className="px-4 py-3 font-medium">作成日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className="relative hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/admin/teams/${t.id}`}
                        className="inline-flex min-h-[44px] items-center break-all text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 after:absolute after:inset-0 after:content-['']"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="block">{t.leaderRealName}</span>
                      <span className="block text-xs text-slate-500">{t.leaderNickname}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.memberCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.activeEntryCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 tabular-nums">
                      {t.createdAt.slice(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 ? (
            <nav aria-label="ページ送り" className="flex items-center justify-between gap-2">
              {page > 1 ? (
                <Link href={pageHref(q, page - 1)} className={pagerClass} rel="prev">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  前へ
                </Link>
              ) : (
                <span className={pagerDisabled} aria-disabled="true">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  前へ
                </span>
              )}
              <span className="text-sm text-slate-600 tabular-nums">
                {page} / {pages}
              </span>
              {page < pages ? (
                <Link href={pageHref(q, page + 1)} className={pagerClass} rel="next">
                  次へ
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className={pagerDisabled} aria-disabled="true">
                  次へ
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
