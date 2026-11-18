// 大会別エントリー状況（クライアント）。フィルタとページは URL の searchParams に反映する。
// 表示テキストは React のエスケープに任せる（Requirement 14.1-14.12, 14.18, 14.22-14.24, 14.28, 14.34, 14.35）。
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type TournamentStatus } from "@/features/tournaments/types/tournament";
import type { EntryStatus } from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import type {
  EntryStatusView as EntryStatusViewData,
  PagedList,
  Section,
} from "@/features/tournaments/types/entryStatus";
import { totalPages } from "@/features/tournaments/utils/pagination";
import { PaymentUpdateControl } from "./PaymentUpdateControl";
import {
  CANCEL_ADMIN_STATUS_LABEL,
  ENTRY_STATUS_LABEL,
  PAYMENT_LABEL,
  WAITLIST_STATUS_LABEL,
} from "./labels";

export interface EntryQueryState {
  status?: EntryStatus;
  payment?: PaymentStatus;
  q: string;
  pageEntries: number;
  pageWaitlist: number;
  pageCancellations: number;
}

interface TournamentSummary {
  id: string;
  title: string;
  eventDate: string;
  status: TournamentStatus;
  capacity: number;
}

const MAX_KEYWORD = 100;
const ENTRY_STATUS_KEYS: EntryStatus[] = ["CONFIRMED", "WAITING", "CANCELLED", "ATTENDED"];
const PAYMENT_KEYS: PaymentStatus[] = ["UNPAID", "PAID", "REFUNDED"];

const FIELD =
  "min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  UNPAID: "bg-slate-100 text-slate-600 border-slate-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REFUNDED: "bg-sky-50 text-sky-700 border-sky-200",
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function TeamName({ name }: { name: string | null }) {
  return name ? (
    <span className="break-words">{name}</span>
  ) : (
    <span className="text-slate-400">チーム未設定</span>
  );
}

function Person({ realName, kanaName }: { realName: string; kanaName: string | null }) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-bold text-slate-900">{realName}</p>
      {kanaName && <p className="break-words text-xs text-slate-500">{kanaName}</p>}
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        再読み込み
      </button>
    </div>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onMove,
}: {
  page: number;
  total: number;
  pageSize: number;
  onMove: (page: number) => void;
}) {
  const pages = totalPages(total, pageSize);
  if (pages <= 1) return null;
  const btn =
    "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-300";
  return (
    <nav aria-label="ページ移動" className="mt-3 flex items-center justify-between gap-2">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onMove(page - 1)}>
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">前のページ</span>
      </button>
      <span className="text-sm text-slate-600 tabular-nums">
        {page} / {pages} ページ
      </span>
      <button
        type="button"
        className={btn}
        disabled={page >= pages}
        onClick={() => onMove(page + 1)}
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">次のページ</span>
      </button>
    </nav>
  );
}

// 一覧 1 つ分の枠。部分失敗・0 件メッセージ・ページャを共通化する。
function ListSection<T>({
  title,
  section,
  filtered,
  emptyAll,
  emptyFiltered,
  page,
  onMove,
  onRetry,
  render,
}: {
  title: string;
  section: Section<PagedList<T>>;
  filtered: boolean;
  emptyAll: string;
  emptyFiltered: string;
  page: number;
  onMove: (page: number) => void;
  onRetry: () => void;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="mb-2 text-base font-bold text-slate-900">
        {title}
        {section.ok && (
          <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums">
            {section.data.total}件
          </span>
        )}
      </h2>
      {!section.ok ? (
        <SectionError message={section.message} onRetry={onRetry} />
      ) : section.data.total === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {filtered ? emptyFiltered : emptyAll}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {section.data.items.map(render)}
          </ul>
          <Pager
            page={section.data.page ?? page}
            total={section.data.total}
            pageSize={section.data.pageSize}
            onMove={onMove}
          />
        </>
      )}
    </section>
  );
}

export function EntryStatusView({
  tournament,
  view,
  query,
  keywordError,
  canManage,
}: {
  tournament: TournamentSummary;
  view: EntryStatusViewData;
  query: EntryQueryState;
  keywordError: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [qInput, setQInput] = useState(query.q);
  const [localError, setLocalError] = useState<string | null>(null);

  const filtered = Boolean(query.status || query.payment || query.q);

  function push(next: EntryQueryState) {
    const sp = new URLSearchParams();
    if (next.status) sp.set("status", next.status);
    if (next.payment) sp.set("payment", next.payment);
    if (next.q) sp.set("q", next.q);
    if (next.pageEntries > 1) sp.set("pe", String(next.pageEntries));
    if (next.pageWaitlist > 1) sp.set("pw", String(next.pageWaitlist));
    if (next.pageCancellations > 1) sp.set("pc", String(next.pageCancellations));
    const qs = sp.toString();
    router.push(qs ? `?${qs}` : "?", { scroll: false });
  }

  // 絞り込み条件の変更は全一覧を 1 ページ目へ戻す（14.22）。
  function applyFilter(patch: Partial<Pick<EntryQueryState, "status" | "payment" | "q">>) {
    push({ ...query, ...patch, pageEntries: 1, pageWaitlist: 1, pageCancellations: 1 });
  }

  function submitKeyword(e: React.FormEvent) {
    e.preventDefault();
    const q = qInput.trim();
    if ([...q].length > MAX_KEYWORD) {
      // 絞り込みを実行せず、直前の結果と条件を保持する（14.18）。
      setLocalError(`キーワードは${MAX_KEYWORD}文字以内で入力してください。`);
      return;
    }
    setLocalError(null);
    applyFilter({ q });
  }

  function reload() {
    router.refresh();
  }

  const error = localError ?? keywordError;
  const counts = view.counts;

  return (
    <div className="mx-auto w-full max-w-4xl p-4 pb-24">
      <Link
        href={`/admin/tournaments/${tournament.id}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        大会詳細へ戻る
      </Link>

      <header className="mt-1">
        <h1 className="break-words text-xl font-bold text-slate-900">{tournament.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="tabular-nums">{tournament.eventDate}</span>
          <Badge className="border-slate-200 bg-slate-100 text-slate-700">
            {STATUS_LABEL[tournament.status]}
          </Badge>
          <span className="tabular-nums">定員 {tournament.capacity}名</span>
        </p>
      </header>

      {/* 件数（絞り込みに依存しない） */}
      <section className="mt-5" aria-label="件数">
        {!counts.ok ? (
          <SectionError message={counts.message} onRetry={reload} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <dl className="grid grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-white p-3">
              {ENTRY_STATUS_KEYS.map((k) => (
                <div key={k} className="min-w-0 text-center">
                  <dt className="text-xs text-slate-500">{ENTRY_STATUS_LABEL[k]}</dt>
                  <dd className="text-lg font-bold text-slate-900 tabular-nums">
                    {counts.data.byStatus[k] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3">
              {PAYMENT_KEYS.map((k) => (
                <div key={k} className="min-w-0 text-center">
                  <dt className="text-xs text-slate-500">{PAYMENT_LABEL[k]}</dt>
                  <dd className="text-lg font-bold text-slate-900 tabular-nums">
                    {counts.data.byPayment[k] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* フィルタ */}
      <form onSubmit={submitKeyword} className="mt-5 grid gap-3 sm:grid-cols-4" role="search">
        <label className="block text-sm text-slate-700">
          エントリー状況
          <select
            className={cn(FIELD, "mt-1")}
            value={query.status ?? ""}
            onChange={(e) =>
              applyFilter({ status: (e.target.value || undefined) as EntryStatus | undefined })
            }
          >
            <option value="">すべて</option>
            {ENTRY_STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {ENTRY_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700">
          入金状況
          <select
            className={cn(FIELD, "mt-1")}
            value={query.payment ?? ""}
            onChange={(e) =>
              applyFilter({ payment: (e.target.value || undefined) as PaymentStatus | undefined })
            }
          >
            <option value="">すべて</option>
            {PAYMENT_KEYS.map((k) => (
              <option key={k} value={k}>
                {PAYMENT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700 sm:col-span-2">
          キーワード（氏名・読み仮名・チーム名）
          <div className="mt-1 flex gap-2">
            <input
              type="search"
              className={FIELD}
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
            <button
              type="submit"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              絞り込む
            </button>
          </div>
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-600 sm:col-span-4">
            {error}
          </p>
        )}
      </form>

      {/* エントリー一覧 */}
      <ListSection
        title="エントリー一覧"
        section={view.entries}
        filtered={filtered}
        emptyAll="まだエントリーがありません。"
        emptyFiltered="条件に該当するエントリーはありません。"
        page={query.pageEntries}
        onMove={(p) => push({ ...query, pageEntries: p })}
        onRetry={reload}
        render={(e) => (
          <li key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Person realName={e.realName} kanaName={e.kanaName} />
                {e.isProxy && (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                    <UserCog aria-hidden="true" className="mr-1 h-3 w-3" />
                    代理登録
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600">
                <TeamName name={e.teamName} />
              </p>
              <p className="text-xs text-slate-500 tabular-nums">申込 {e.appliedAt}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                  {ENTRY_STATUS_LABEL[e.status]}
                </Badge>
                <Badge className={PAYMENT_STYLE[e.paymentStatus]}>
                  {PAYMENT_LABEL[e.paymentStatus]}
                </Badge>
              </div>
              {e.paidAt && (
                <p className="text-xs text-slate-500 tabular-nums">入金日時 {e.paidAt}</p>
              )}
              {canManage && (
                <PaymentUpdateControl
                  tournamentId={tournament.id}
                  entryId={e.id}
                  realName={e.realName}
                  paymentStatus={e.paymentStatus}
                  entryStatus={e.status}
                />
              )}
            </div>
          </li>
        )}
      />

      {/* キャンセル待ち一覧 */}
      <ListSection
        title="キャンセル待ち一覧"
        section={view.waitlist}
        filtered={Boolean(query.q)}
        emptyAll="まだキャンセル待ちがありません。"
        emptyFiltered="条件に該当するキャンセル待ちはありません。"
        page={query.pageWaitlist}
        onMove={(p) => push({ ...query, pageWaitlist: p })}
        onRetry={reload}
        render={(w) => (
          <li key={w.id} className="flex items-center gap-3 p-3">
            <span className="w-10 shrink-0 text-center text-sm font-bold text-slate-700 tabular-nums">
              {w.queueNumber}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <Person realName={w.realName} kanaName={w.kanaName} />
              <p className="text-xs text-slate-600">
                <TeamName name={w.teamName} />
              </p>
            </div>
            <Badge className="border-slate-200 bg-slate-100 text-slate-700">
              {WAITLIST_STATUS_LABEL[w.status]}
            </Badge>
          </li>
        )}
      />

      {/* キャンセル一覧（有償・無償と対応状況は入金状況とは別の項目） */}
      <ListSection
        title="キャンセル一覧"
        section={view.cancellations}
        filtered={Boolean(query.q)}
        emptyAll="まだキャンセルがありません。"
        emptyFiltered="条件に該当するキャンセルはありません。"
        page={query.pageCancellations}
        onMove={(p) => push({ ...query, pageCancellations: p })}
        onRetry={reload}
        render={(c) => (
          <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <Person realName={c.realName} kanaName={c.kanaName} />
              <p className="text-xs text-slate-600">
                <TeamName name={c.teamName} />
              </p>
              <p className="text-xs text-slate-500 tabular-nums">キャンセル {c.cancelledAt}</p>
              <p className="text-xs text-slate-600 tabular-nums">
                キャンセル料 {c.feeAmount.toLocaleString("ja-JP")}円
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  c.isPaid
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-100 text-slate-700"
                }
              >
                {c.isPaid ? "有償キャンセル" : "無償キャンセル"}
              </Badge>
              <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                対応: {CANCEL_ADMIN_STATUS_LABEL[c.adminStatus]}
              </Badge>
            </div>
          </li>
        )}
      />
    </div>
  );
}
