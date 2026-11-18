// ステータス変更・中止用のリポジトリ。SQL はこの層にのみ閉じ込める（バインド変数のみ）。
// payment_status と paid_at には触れない（Requirement 7.14）。

import { db, NOW_JST } from "@/lib/db";
import { CONFIRMED_ENTRY_SQL } from "@/features/tournaments/server/tournamentAdminRepository";
import type { CancelImpact } from "@/features/tournaments/types/adminTournament";
import type { TournamentStatus } from "@/features/tournaments/types/tournament";

// 請求中のキャンセル（有償かつ未解決）の判定条件（cancellations のエイリアスは c）。
const BILLING_CANCELLATION_SQL =
  "c.is_paid = 1 AND c.admin_status IN ('UNCONTACTED','IN_CONSULTATION')";

function count(sql: string, id: string): number {
  const row = db.prepare(sql).get(id) as { c: number };
  return row.c;
}

// 中止確認ダイアログ用の 4 件数。
export function getCancelImpactCounts(tournamentId: string): CancelImpact {
  return {
    confirmedCount: count(
      `SELECT COUNT(*) AS c FROM entries e WHERE e.tournament_id = ? AND ${CONFIRMED_ENTRY_SQL}`,
      tournamentId,
    ),
    waitingCount: count(
      "SELECT COUNT(*) AS c FROM waitlists w WHERE w.tournament_id = ? AND w.status = 'WAITING'",
      tournamentId,
    ),
    billingCancellationCount: count(
      `SELECT COUNT(*) AS c FROM cancellations c
         JOIN entries e ON e.id = c.entry_id
        WHERE e.tournament_id = ? AND ${BILLING_CANCELLATION_SQL}`,
      tournamentId,
    ),
    paidCount: count(
      `SELECT COUNT(*) AS c FROM entries e
        WHERE e.tournament_id = ? AND e.status IN ('CONFIRMED','ATTENDED')
          AND e.payment_status = 'PAID'`,
      tournamentId,
    ),
  };
}

// 楽観ロックつきのステータス更新（中止以外）。更新できたら true。
export function updateStatusRow(
  id: string,
  to: TournamentStatus,
  expectedStatus: TournamentStatus,
  expectedUpdatedAt: string,
): boolean {
  const r = db
    .prepare(
      `UPDATE tournaments SET status = ?, updated_at = ${NOW_JST}
        WHERE id = ? AND status = ? AND updated_at = ?`,
    )
    .run(to, id, expectedStatus, expectedUpdatedAt);
  return Number(r.changes) > 0;
}

export interface CancelRecipient {
  entryId: string;
  userId: string;
  email: string;
}

export type CancelTxResult =
  | { ok: true; recipients: CancelRecipient[]; updatedAt: string }
  | { ok: false; reason: "STALE" };

// 中止の連鎖更新を 1 トランザクションで行う。失敗時はロールバックして例外を再送出する。
// 1. 大会 → CANCELLED（楽観ロック）
// 2. キャンセル待ち WAITING/OFFERED → EXPIRED
// 3. 請求中キャンセル → WAIVED（admin_notes に追記）
export function cancelTournamentTx(
  id: string,
  expectedStatus: TournamentStatus,
  expectedUpdatedAt: string,
): CancelTxResult {
  db.exec("BEGIN");
  try {
    const t = db
      .prepare(
        `UPDATE tournaments SET status = 'CANCELLED', updated_at = ${NOW_JST}
          WHERE id = ? AND status = ? AND updated_at = ?`,
      )
      .run(id, expectedStatus, expectedUpdatedAt);
    if (Number(t.changes) === 0) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "STALE" };
    }

    db.prepare(
      `UPDATE waitlists SET status = 'EXPIRED', updated_at = ${NOW_JST}
        WHERE tournament_id = ? AND status IN ('WAITING','OFFERED')`,
    ).run(id);

    db.prepare(
      `UPDATE cancellations
          SET admin_status = 'WAIVED',
              admin_notes = COALESCE(admin_notes || char(10), '')
                || '[大会中止により請求を取り下げ ' || strftime('%Y-%m-%d %H:%M', 'now', '+9 hours') || ']',
              updated_at = ${NOW_JST}
        WHERE is_paid = 1 AND admin_status IN ('UNCONTACTED','IN_CONSULTATION')
          AND entry_id IN (SELECT id FROM entries WHERE tournament_id = ?)`,
    ).run(id);

    const recipients = (
      db
        .prepare(
          `SELECT e.id AS entry_id, u.id AS user_id, u.email AS email
             FROM entries e JOIN users u ON u.id = e.user_id
            WHERE e.tournament_id = ? AND ${CONFIRMED_ENTRY_SQL}
            ORDER BY e.applied_at ASC, e.id ASC`,
        )
        .all(id) as Array<{ entry_id: string; user_id: string; email: string }>
    ).map((r) => ({ entryId: r.entry_id, userId: r.user_id, email: r.email }));

    const row = db
      .prepare("SELECT updated_at FROM tournaments WHERE id = ?")
      .get(id) as { updated_at: string };

    db.exec("COMMIT");
    return { ok: true, recipients, updatedAt: row.updated_at };
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ロールバック失敗は元の例外を優先する
    }
    throw e;
  }
}
