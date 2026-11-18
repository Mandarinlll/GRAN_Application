// 大会別エントリー状況（URL: /admin/tournaments/{id}/entries）。ADMIN / OPERATOR。
// フィルタ・ページは URL の searchParams で保持する（Requirement 14.1-14.5, 14.22, 15.25）。
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/server/guard";
import { roleHasPermission } from "@/features/admin/utils/permissions";
import { findAdminTournamentById } from "@/features/tournaments/server/tournamentAdminRepository";
import {
  getEntryStatusView,
  MAX_KEYWORD_LENGTH,
} from "@/features/tournaments/server/entryStatusService";
import type { EntryStatus } from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import { EntryStatusView, type EntryQueryState } from "./EntryStatusView";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTRY_STATUSES: readonly string[] = ["CONFIRMED", "WAITING", "CANCELLED", "ATTENDED"];
const PAYMENT_STATUSES: readonly string[] = ["UNPAID", "PAID", "REFUNDED"];

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function toPage(v: string | string[] | undefined): number {
  const n = Number(one(v));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default async function AdminTournamentEntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdminPage("entries.view");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const tournament = findAdminTournamentById(id);
  if (!tournament) notFound();

  const sp = await searchParams;
  const rawStatus = one(sp.status);
  const rawPayment = one(sp.payment);
  const rawQ = (one(sp.q) ?? "").trim();

  const query: EntryQueryState = {
    status:
      rawStatus && ENTRY_STATUSES.includes(rawStatus)
        ? (rawStatus as EntryStatus)
        : undefined,
    payment:
      rawPayment && PAYMENT_STATUSES.includes(rawPayment)
        ? (rawPayment as PaymentStatus)
        : undefined,
    q: rawQ,
    pageEntries: toPage(sp.pe),
    pageWaitlist: toPage(sp.pw),
    pageCancellations: toPage(sp.pc),
  };

  // 100 文字超のキーワードは絞り込みを実行せず、エラー表示のみ行う（14.18）。
  const keywordTooLong = [...rawQ].length > MAX_KEYWORD_LENGTH;
  const result = await getEntryStatusView(id, {
    ...query,
    q: keywordTooLong ? undefined : rawQ || undefined,
  });
  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4" role="alert">
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {result.message}
        </p>
      </div>
    );
  }

  return (
    <EntryStatusView
      tournament={{
        id: tournament.id,
        title: tournament.title,
        eventDate: tournament.eventDate,
        status: tournament.status,
        capacity: tournament.capacity,
      }}
      view={result.data}
      query={query}
      keywordError={
        keywordTooLong
          ? `キーワードは${MAX_KEYWORD_LENGTH}文字以内で入力してください。`
          : null
      }
      canManage={roleHasPermission(admin.role, "entries.manage")}
    />
  );
}
