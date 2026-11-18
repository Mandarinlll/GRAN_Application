// 入金状況の遷移表と更新計画（純粋関数）。
// Requirement 15.7, 15.8, 15.15-15.19, 15.30。

import type { EntryStatus } from "@/features/entries/types/entry";
import type { PaymentStatus } from "../types/adminTournament";

export const ALLOWED_PAYMENT_TRANSITIONS: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  UNPAID: ["PAID"],
  PAID: ["UNPAID", "REFUNDED"],
  REFUNDED: [],
};

export type PaidAtMode = "SET_NOW" | "CLEAR" | "KEEP";

export type PaymentPlan =
  | { kind: "INVALID_VALUE" }
  | { kind: "STALE" }
  | { kind: "NOOP" }
  | { kind: "FORBIDDEN_TRANSITION" }
  | { kind: "ENTRY_STATUS_BLOCKED" }
  | { kind: "APPLY"; paidAt: PaidAtMode };

const PAYMENT_VALUES: readonly PaymentStatus[] = ["UNPAID", "PAID", "REFUNDED"];

function isPaymentStatus(v: unknown): v is PaymentStatus {
  return typeof v === "string" && (PAYMENT_VALUES as readonly string[]).includes(v);
}

export function planPaymentUpdate(input: {
  entryStatus: EntryStatus;
  current: PaymentStatus;
  expectedFrom: PaymentStatus;
  to: unknown;
}): PaymentPlan {
  const { entryStatus, current, expectedFrom, to } = input;
  if (!isPaymentStatus(to)) return { kind: "INVALID_VALUE" };
  if (expectedFrom !== current) return { kind: "STALE" };
  if (current === to) return { kind: "NOOP" };
  if (!ALLOWED_PAYMENT_TRANSITIONS[current].includes(to)) {
    return { kind: "FORBIDDEN_TRANSITION" };
  }
  if (to === "PAID" && (entryStatus === "CANCELLED" || entryStatus === "WAITING")) {
    return { kind: "ENTRY_STATUS_BLOCKED" };
  }
  if (to === "PAID") return { kind: "APPLY", paidAt: "SET_NOW" };
  if (to === "UNPAID") return { kind: "APPLY", paidAt: "CLEAR" };
  return { kind: "APPLY", paidAt: "KEEP" };
}

// UI で操作可能な入金状況の候補（planPaymentUpdate が APPLY を返す値のみ）。
export function allowedPaymentActions(
  current: PaymentStatus,
  entryStatus: EntryStatus,
): PaymentStatus[] {
  return PAYMENT_VALUES.filter(
    (to) =>
      planPaymentUpdate({ entryStatus, current, expectedFrom: current, to })
        .kind === "APPLY",
  );
}
