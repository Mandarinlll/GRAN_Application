// 入金状況更新のサービス層。
// BEGIN → エントリー取得 → planPaymentUpdate → UPDATE（楽観ロック）→ ログ 1 件 → COMMIT。
// 失敗時は ROLLBACK。Requirement 13.21, 15.4, 15.9-15.12, 15.18-15.23, 15.28-15.31。

import type { AdminContext } from "@/features/admin/types/permissions";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import { planPaymentUpdate } from "@/features/tournaments/utils/paymentTransitions";
import {
  beginTransaction,
  commitTransaction,
  findEntryForPayment,
  insertPaymentLog,
  rollbackTransaction,
  updateEntryPayment,
} from "@/features/tournaments/server/paymentRepository";

export type PaymentErrorCode =
  | "INVALID_VALUE"
  | "NOT_FOUND"
  | "CONFLICT_STALE"
  | "FORBIDDEN_TRANSITION"
  | "ENTRY_STATUS_BLOCKED"
  | "ALREADY_UPDATED"
  | "DB_ERROR";

export type PaymentResult =
  | { ok: true; data: { entryId: string; from: PaymentStatus; to: PaymentStatus } }
  | { ok: false; code: PaymentErrorCode; message: string };

export interface UpdatePaymentInput {
  tournamentId: string;
  entryId: string;
  to: unknown;
  expectedFrom: PaymentStatus;
}

const MESSAGES: Record<PaymentErrorCode, string> = {
  INVALID_VALUE: "入金状況の値が正しくありません。",
  NOT_FOUND: "対象のエントリーが見つかりません。",
  CONFLICT_STALE: "他の操作で更新されました。再読み込みしてください。",
  FORBIDDEN_TRANSITION: "この入金状況への変更はできません。",
  ENTRY_STATUS_BLOCKED: "このエントリーのステータスでは入金済みにできません。",
  ALREADY_UPDATED: "既に更新済みです。",
  DB_ERROR: "保存に失敗しました。時間をおいて再度お試しください。",
};

function fail(code: PaymentErrorCode): PaymentResult {
  return { ok: false, code, message: MESSAGES[code] };
}

export function updatePayment(
  admin: AdminContext,
  input: UpdatePaymentInput,
): PaymentResult {
  try {
    beginTransaction();
  } catch {
    return fail("DB_ERROR");
  }
  try {
    const entry = findEntryForPayment(input.tournamentId, input.entryId);
    if (!entry) {
      rollbackTransaction();
      return fail("NOT_FOUND");
    }

    const plan = planPaymentUpdate({
      entryStatus: entry.status,
      current: entry.paymentStatus,
      expectedFrom: input.expectedFrom,
      to: input.to,
    });
    if (plan.kind !== "APPLY") {
      rollbackTransaction();
      switch (plan.kind) {
        case "STALE":
          return fail("CONFLICT_STALE");
        case "NOOP":
          return fail("ALREADY_UPDATED");
        default:
          return fail(plan.kind);
      }
    }

    const to = input.to as PaymentStatus;
    const updated = updateEntryPayment(
      entry.id,
      to,
      entry.paymentStatus,
      plan.paidAt,
    );
    if (!updated) {
      rollbackTransaction();
      return fail("CONFLICT_STALE");
    }
    insertPaymentLog({
      entryId: entry.id,
      fromStatus: entry.paymentStatus,
      toStatus: to,
      changedBy: admin.userId,
    });
    commitTransaction();
    return { ok: true, data: { entryId: entry.id, from: entry.paymentStatus, to } };
  } catch {
    rollbackTransaction();
    return fail("DB_ERROR");
  }
}
