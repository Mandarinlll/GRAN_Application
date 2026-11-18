// 管理者向けエントリー状況の閲覧サービス。
// 先頭で requireAdmin("entries.view") を呼ぶ（Requirement 14.26、14.27）。権限エラーは AdminAccessError を投げる。
// 4 つの部分（件数・エントリー・キャンセル待ち・キャンセル）は個別に try/catch し、
// 失敗した部分だけ { ok: false } にする（Requirement 14.28）。

import { requireAdmin } from "@/features/admin/server/guard";
import type { EntryStatus } from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import type {
  EntryStatusQuery,
  EntryStatusView,
  Section,
} from "@/features/tournaments/types/entryStatus";
import {
  getEntryCounts,
  listCancellations,
  listEntries,
  listWaitlist,
} from "./entryStatusRepository";

export const MAX_KEYWORD_LENGTH = 100;

const ENTRY_STATUSES: readonly string[] = ["CONFIRMED", "WAITING", "CANCELLED", "ATTENDED"];
const PAYMENT_STATUSES: readonly string[] = ["UNPAID", "PAID", "REFUNDED"];

export type EntryStatusViewResult =
  | { ok: true; data: EntryStatusView }
  | { ok: false; code: "VALIDATION"; message: string };

function section<T>(label: string, fn: () => T): Section<T> {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    console.error(`[entryStatus] ${label} の取得に失敗しました`, e);
    return { ok: false, message: `${label}を取得できませんでした。再読み込みしてください。` };
  }
}

export async function getEntryStatusView(
  tournamentId: string,
  query: Partial<EntryStatusQuery> = {},
): Promise<EntryStatusViewResult> {
  await requireAdmin("entries.view");

  const q = typeof query.q === "string" ? query.q.trim() : "";
  if ([...q].length > MAX_KEYWORD_LENGTH) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `キーワードは${MAX_KEYWORD_LENGTH}文字以内で入力してください。`,
    };
  }
  if (query.status !== undefined && !ENTRY_STATUSES.includes(query.status)) {
    return { ok: false, code: "VALIDATION", message: "エントリー状況の指定が不正です。" };
  }
  if (query.payment !== undefined && !PAYMENT_STATUSES.includes(query.payment)) {
    return { ok: false, code: "VALIDATION", message: "入金状況の指定が不正です。" };
  }

  const keyword = q === "" ? undefined : q;
  const status = query.status as EntryStatus | undefined;
  const payment = query.payment as PaymentStatus | undefined;

  return {
    ok: true,
    data: {
      tournamentId,
      counts: section("件数", () => getEntryCounts(tournamentId)),
      entries: section("エントリー一覧", () =>
        listEntries(tournamentId, { status, payment, q: keyword }, query.pageEntries ?? 1),
      ),
      waitlist: section("キャンセル待ち一覧", () =>
        listWaitlist(tournamentId, { q: keyword }, query.pageWaitlist ?? 1),
      ),
      cancellations: section("キャンセル一覧", () =>
        listCancellations(tournamentId, { q: keyword }, query.pageCancellations ?? 1),
      ),
    },
  };
}
