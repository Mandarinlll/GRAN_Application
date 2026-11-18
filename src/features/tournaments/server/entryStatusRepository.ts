// 管理者向けエントリー状況のリポジトリ。SQL はこの層にのみ閉じ込める。
// - すべてバインド変数。LIKE のワイルドカード（% _ \）はエスケープして ESCAPE '\' を付ける。
// - 取得する個人情報列は real_name / kana_name / チーム名のみ（Requirement 14.25）。
// - 件数は絞り込み条件に依存しない（Requirement 14.20、14.33）。

import { db } from "@/lib/db";
import type {
  CancellationAdminStatus,
  EntryStatus,
  WaitlistStatus,
} from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import type {
  CancellationRowDto,
  EntryCounts,
  EntryRowDto,
  PagedList,
  WaitlistRowDto,
} from "@/features/tournaments/types/entryStatus";
import { PAGE_SIZE, clampPage, pageOffset } from "@/features/tournaments/utils/pagination";

const ENTRY_STATUSES: readonly EntryStatus[] = ["CONFIRMED", "WAITING", "CANCELLED", "ATTENDED"];
const PAYMENT_STATUSES: readonly PaymentStatus[] = ["UNPAID", "PAID", "REFUNDED"];

// LIKE のメタ文字をエスケープし、部分一致パターンにする。
export function toLikePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// キーワード条件。未指定なら条件なし（バインド値なし）。
function keywordClause(
  keyword: string | undefined,
  columns: string[],
): { sql: string; params: string[] } {
  if (!keyword) return { sql: "", params: [] };
  const pattern = toLikePattern(keyword);
  return {
    sql: ` AND (${columns.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(" OR ")})`,
    params: columns.map(() => pattern),
  };
}

const NAME_COLUMNS = ["u.real_name", "u.kana_name", "t.name"];

export function getEntryCounts(tournamentId: string): EntryCounts {
  const byStatus = Object.fromEntries(ENTRY_STATUSES.map((s) => [s, 0])) as Record<
    EntryStatus,
    number
  >;
  const byPayment = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0])) as Record<
    PaymentStatus,
    number
  >;

  const statusRows = db
    .prepare("SELECT status, COUNT(*) AS n FROM entries WHERE tournament_id = ? GROUP BY status")
    .all(tournamentId) as { status: EntryStatus; n: number }[];
  for (const r of statusRows) if (r.status in byStatus) byStatus[r.status] = r.n;

  const paymentRows = db
    .prepare(
      "SELECT payment_status AS status, COUNT(*) AS n FROM entries WHERE tournament_id = ? GROUP BY payment_status",
    )
    .all(tournamentId) as { status: PaymentStatus; n: number }[];
  for (const r of paymentRows) if (r.status in byPayment) byPayment[r.status] = r.n;

  return { byStatus, byPayment };
}

interface EntryRow {
  id: string;
  status: EntryStatus;
  payment_status: PaymentStatus;
  paid_at: string | null;
  is_proxy: number;
  applied_at: string;
  real_name: string;
  kana_name: string | null;
  team_name: string | null;
}

export function listEntries(
  tournamentId: string,
  filter: { status?: EntryStatus; payment?: PaymentStatus; q?: string },
  page: number,
): PagedList<EntryRowDto> {
  const where: string[] = ["e.tournament_id = ?"];
  const params: (string | number)[] = [tournamentId];
  if (filter.status) {
    where.push("e.status = ?");
    params.push(filter.status);
  }
  if (filter.payment) {
    where.push("e.payment_status = ?");
    params.push(filter.payment);
  }
  const kw = keywordClause(filter.q, NAME_COLUMNS);
  const from = `FROM entries e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN teams t ON t.id = e.team_id
     WHERE ${where.join(" AND ")}${kw.sql}`;
  const allParams = [...params, ...kw.params];

  const total = (db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...allParams) as { n: number }).n;
  const current = clampPage(page, total);
  const rows = db
    .prepare(
      `SELECT e.id, e.status, e.payment_status, e.paid_at, e.is_proxy, e.applied_at,
              u.real_name, u.kana_name, t.name AS team_name
       ${from}
       ORDER BY e.applied_at ASC, e.id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...allParams, PAGE_SIZE, pageOffset(current)) as unknown as EntryRow[];

  return {
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      paymentStatus: r.payment_status,
      paidAt: r.paid_at,
      isProxy: r.is_proxy === 1,
      appliedAt: r.applied_at,
      realName: r.real_name,
      kanaName: r.kana_name,
      teamName: r.team_name,
    })),
    total,
    page: current,
    pageSize: PAGE_SIZE,
  };
}

interface WaitlistRow {
  id: string;
  queue_number: number;
  status: WaitlistStatus;
  real_name: string;
  kana_name: string | null;
  team_name: string | null;
}

export function listWaitlist(
  tournamentId: string,
  filter: { q?: string },
  page: number,
): PagedList<WaitlistRowDto> {
  const kw = keywordClause(filter.q, NAME_COLUMNS);
  const from = `FROM waitlists w
      JOIN users u ON u.id = w.user_id
      LEFT JOIN teams t ON t.id = w.team_id
     WHERE w.tournament_id = ?${kw.sql}`;
  const params = [tournamentId, ...kw.params];

  const total = (db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params) as { n: number }).n;
  const current = clampPage(page, total);
  const rows = db
    .prepare(
      `SELECT w.id, w.queue_number, w.status, u.real_name, u.kana_name, t.name AS team_name
       ${from}
       ORDER BY w.queue_number ASC, w.id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, PAGE_SIZE, pageOffset(current)) as unknown as WaitlistRow[];

  return {
    items: rows.map((r) => ({
      id: r.id,
      queueNumber: r.queue_number,
      status: r.status,
      realName: r.real_name,
      kanaName: r.kana_name,
      teamName: r.team_name,
    })),
    total,
    page: current,
    pageSize: PAGE_SIZE,
  };
}

interface CancellationRow {
  id: string;
  entry_id: string;
  cancelled_at: string;
  is_paid: number;
  fee_amount: number;
  admin_status: CancellationAdminStatus;
  real_name: string;
  kana_name: string | null;
  team_name: string | null;
}

export function listCancellations(
  tournamentId: string,
  filter: { q?: string },
  page: number,
): PagedList<CancellationRowDto> {
  const kw = keywordClause(filter.q, NAME_COLUMNS);
  const from = `FROM cancellations c
      JOIN entries e ON e.id = c.entry_id
      JOIN users u ON u.id = e.user_id
      LEFT JOIN teams t ON t.id = e.team_id
     WHERE e.tournament_id = ?${kw.sql}`;
  const params = [tournamentId, ...kw.params];

  const total = (db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params) as { n: number }).n;
  const current = clampPage(page, total);
  const rows = db
    .prepare(
      `SELECT c.id, c.entry_id, c.cancelled_at, c.is_paid, c.fee_amount, c.admin_status,
              u.real_name, u.kana_name, t.name AS team_name
       ${from}
       ORDER BY c.cancelled_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, PAGE_SIZE, pageOffset(current)) as unknown as CancellationRow[];

  return {
    items: rows.map((r) => ({
      id: r.id,
      entryId: r.entry_id,
      cancelledAt: r.cancelled_at,
      isPaid: r.is_paid === 1,
      feeAmount: r.fee_amount,
      adminStatus: r.admin_status,
      realName: r.real_name,
      kanaName: r.kana_name,
      teamName: r.team_name,
    })),
    total,
    page: current,
    pageSize: PAGE_SIZE,
  };
}
