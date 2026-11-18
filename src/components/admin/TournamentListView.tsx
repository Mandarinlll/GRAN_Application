// 管理者向け大会一覧（クライアント）。絞り込み・並び替えは listFilter の純粋関数で行う。
// 768px 未満はカード、以上は表。OPERATOR には操作要素（登録リンク）を出さない。
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarPlus, ListPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  TIER_LABEL,
  type TournamentStatus,
} from "@/features/tournaments/types/tournament";
import type { AdminTournamentListRow } from "@/features/tournaments/types/adminTournament";
import {
  filterTournaments,
  sortTournaments,
  validateDateRange,
} from "@/features/tournaments/utils/listFilter";

const STATUS_STYLE: Record<TournamentStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  UPCOMING: "bg-sky-50 text-sky-700 border-sky-200",
  OPEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-amber-50 text-amber-700 border-amber-200",
  FINISHED: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_OPTIONS = Object.keys(STATUS_LABEL) as TournamentStatus[];

const FIELD =
  "min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";
const LINK_BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TournamentListView({
  rows,
  canManage,
}: {
  rows: AdminTournamentListRow[];
  canManage: boolean;
}) {
  // 入力中の値
  const [status, setStatus] = useState<TournamentStatus | "">("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // 期間が不正でないときだけ更新する、一覧に適用中の期間
  const [applied, setApplied] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  const rangeError = validateDateRange(from || undefined, to || undefined);

  function changeDate(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (!validateDateRange(nextFrom || undefined, nextTo || undefined)) {
      setApplied({ from: nextFrom, to: nextTo });
    }
  }

  const visible = useMemo(
    () =>
      sortTournaments(
        filterTournaments(rows, {
          status: status || undefined,
          q: q || undefined,
          from: applied.from || undefined,
          to: applied.to || undefined,
        }),
      ),
    [rows, status, q, applied],
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">大会管理</h1>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/tournaments/new"
              className={cn(
                LINK_BTN,
                "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800",
              )}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              大会を登録
            </Link>
            <Link
              href="/admin/tournaments/bulk"
              className={cn(
                LINK_BTN,
                "border border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50",
              )}
            >
              <ListPlus className="h-4 w-4" aria-hidden />
              一括登録
            </Link>
          </div>
        )}
      </div>

      <section
        aria-label="絞り込み"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <label className="block text-xs font-medium text-slate-600">
          ステータス
          <select
            className={cn(FIELD, "mt-1")}
            value={status}
            onChange={(e) => setStatus(e.target.value as TournamentStatus | "")}
          >
            <option value="">すべて</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          大会名
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="大会名の一部"
              className={cn(FIELD, "pl-9")}
            />
          </div>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          開催日（開始）
          <input
            type="date"
            value={from}
            onChange={(e) => changeDate(e.target.value, to)}
            className={cn(FIELD, "mt-1 tabular-nums")}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          開催日（終了）
          <input
            type="date"
            value={to}
            onChange={(e) => changeDate(from, e.target.value)}
            className={cn(FIELD, "mt-1 tabular-nums")}
          />
        </label>
        {rangeError && (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-sm text-rose-600 sm:col-span-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {rangeError}
          </p>
        )}
      </section>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          該当する大会がありません。
        </p>
      ) : (
        <>
          {/* 768px 未満: カード */}
          <ul className="space-y-2 md:hidden">
            {visible.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/tournaments/${r.id}`}
                  className="block min-h-[44px] rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900">{r.title}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-slate-600">
                    {r.eventDate} ・ {r.venue}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {CATEGORY_LABEL[r.category]} ・ {TIER_LABEL[r.tier]}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-slate-700">
                    確定 {r.confirmedCount} / 定員 {r.capacity}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* 768px 以上: 表 */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">大会名</th>
                  <th scope="col" className="px-3 py-3">開催日</th>
                  <th scope="col" className="px-3 py-3">種目</th>
                  <th scope="col" className="px-3 py-3">階級</th>
                  <th scope="col" className="px-3 py-3">会場</th>
                  <th scope="col" className="px-3 py-3">状態</th>
                  <th scope="col" className="px-3 py-3 text-right">定員</th>
                  <th scope="col" className="px-3 py-3 text-right">確定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-1">
                      <Link
                        href={`/admin/tournaments/${r.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg font-medium text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 tabular-nums">{r.eventDate}</td>
                    <td className="whitespace-nowrap px-3 py-1">{CATEGORY_LABEL[r.category]}</td>
                    <td className="whitespace-nowrap px-3 py-1">{TIER_LABEL[r.tier]}</td>
                    <td className="px-3 py-1">{r.venue}</td>
                    <td className="px-3 py-1">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{r.capacity}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{r.confirmedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
