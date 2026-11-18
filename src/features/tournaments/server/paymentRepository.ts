// 入金状況の更新に使うリポジトリ。SQL はこの層にのみ閉じ込める（すべてバインド変数）。
// トランザクション境界（BEGIN/COMMIT/ROLLBACK）は paymentService が持つ。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type { EntryStatus } from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import type { PaidAtMode } from "@/features/tournaments/utils/paymentTransitions";

export interface PaymentEntryRow {
  id: string;
  status: EntryStatus;
  paymentStatus: PaymentStatus;
}

// 大会に属するエントリーだけを返す（別大会のエントリー ID は null）。
export function findEntryForPayment(
  tournamentId: string,
  entryId: string,
): PaymentEntryRow | null {
  const row = db
    .prepare(
      "SELECT id, status, payment_status FROM entries WHERE id = ? AND tournament_id = ?",
    )
    .get(entryId, tournamentId) as
    | { id: string; status: EntryStatus; payment_status: PaymentStatus }
    | undefined;
  if (!row) return null;
  return { id: row.id, status: row.status, paymentStatus: row.payment_status };
}

// 楽観ロックつき更新。payment_status が expectedFrom と一致しなければ false。
// paid_at: SET_NOW=現在時刻（JST）/ CLEAR=NULL / KEEP=変更しない。
export function updateEntryPayment(
  entryId: string,
  to: PaymentStatus,
  expectedFrom: PaymentStatus,
  paidAt: PaidAtMode,
): boolean {
  const paidAtSql =
    paidAt === "SET_NOW" ? NOW_JST : paidAt === "CLEAR" ? "NULL" : "paid_at";
  const result = db
    .prepare(
      `UPDATE entries
          SET payment_status = ?, paid_at = ${paidAtSql}, updated_at = ${NOW_JST}
        WHERE id = ? AND payment_status = ?`,
    )
    .run(to, entryId, expectedFrom);
  return Number(result.changes) > 0;
}

// 更新後の paid_at を返す（API 応答用）。
export function findEntryPaidAt(entryId: string): string | null {
  const row = db
    .prepare("SELECT paid_at FROM entries WHERE id = ?")
    .get(entryId) as { paid_at: string | null } | undefined;
  return row?.paid_at ?? null;
}

export function insertPaymentLog(input: {
  entryId: string;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
  changedBy: string;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO entry_payment_logs (id, entry_id, from_status, to_status, changed_by, changed_at)
     VALUES (?, ?, ?, ?, ?, ${NOW_JST})`,
  ).run(id, input.entryId, input.fromStatus, input.toStatus, input.changedBy);
  return id;
}

export function beginTransaction(): void {
  db.exec("BEGIN");
}

export function commitTransaction(): void {
  db.exec("COMMIT");
}

export function rollbackTransaction(): void {
  try {
    db.exec("ROLLBACK");
  } catch {
    // ロールバック失敗は元の結果を優先する
  }
}
