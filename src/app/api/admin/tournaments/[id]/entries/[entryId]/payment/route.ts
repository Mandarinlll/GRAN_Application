// 入金状況の更新（POST）。1 リクエスト 1 エントリー。権限 entries.manage。
// Requirement 4.2, 15.4-15.6, 15.19, 15.31。
import { NextResponse } from "next/server";
import { withAdminApi } from "@/features/admin/server/guard";
import {
  updatePayment,
  type PaymentErrorCode,
} from "@/features/tournaments/server/paymentService";
import { findEntryPaidAt } from "@/features/tournaments/server/paymentRepository";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const STATUS_BY_CODE: Record<Exclude<PaymentErrorCode, "ALREADY_UPDATED">, number> = {
  INVALID_VALUE: 400,
  FORBIDDEN_TRANSITION: 409,
  ENTRY_STATUS_BLOCKED: 409,
  CONFLICT_STALE: 409,
  NOT_FOUND: 404,
  DB_ERROR: 500,
};

const PAYMENT_VALUES = ["UNPAID", "PAID", "REFUNDED"];

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, code: "INVALID_VALUE", message },
    { status: 400 },
  );
}

export const POST = withAdminApi<Ctx>(
  "entries.manage",
  async (req, { params }, admin) => {
    const { id, entryId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("リクエストの形式が正しくありません。");
    }
    // 配列（複数エントリーの一括更新）やオブジェクト以外は受け付けない。
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("リクエストの形式が正しくありません。");
    }
    const { to, expectedFrom } = body as { to?: unknown; expectedFrom?: unknown };
    if (typeof expectedFrom !== "string" || !PAYMENT_VALUES.includes(expectedFrom)) {
      return badRequest("入金状況の値が正しくありません。");
    }

    const result = updatePayment(admin, {
      tournamentId: id,
      entryId,
      to,
      expectedFrom: expectedFrom as PaymentStatus,
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        paymentStatus: result.data.to,
        paidAt: findEntryPaidAt(result.data.entryId),
      });
    }
    if (result.code === "ALREADY_UPDATED") {
      return NextResponse.json({
        ok: true,
        alreadyUpdated: true,
        message: result.message,
      });
    }
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: STATUS_BY_CODE[result.code] },
    );
  },
);
