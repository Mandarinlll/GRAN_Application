import type { AccountStatus } from "@/types/user";

export type StatusAction = "SUSPEND" | "REACTIVATE";

// SUSPEND は ACTIVE のときだけ SUSPENDED へ、REACTIVATE は SUSPENDED のときだけ ACTIVE へ。
// PROVISIONAL はどちらも不可。
export function planStatusChange(
  current: AccountStatus,
  action: StatusAction,
): { ok: true; to: AccountStatus } | { ok: false } {
  if (action === "SUSPEND" && current === "ACTIVE") return { ok: true, to: "SUSPENDED" };
  if (action === "REACTIVATE" && current === "SUSPENDED") return { ok: true, to: "ACTIVE" };
  return { ok: false };
}
