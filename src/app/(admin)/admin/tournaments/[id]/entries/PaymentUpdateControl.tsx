// 入金状況の更新操作（entries.manage を持つ場合のみ親が描画する）。
// 確認ダイアログ → POST /api/admin/tournaments/{id}/entries/{entryId}/payment → トースト → router.refresh()。
// refresh は URL を変えないため、絞り込みとページが保持される（Requirement 15.2, 15.13, 15.14, 15.24-15.27）。
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastState } from "@/components/ui/Toast";
import type { EntryStatus } from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";
import { allowedPaymentActions } from "@/features/tournaments/utils/paymentTransitions";
import { PAYMENT_LABEL } from "./labels";

const ACTION_LABEL: Record<PaymentStatus, string> = {
  PAID: "入金済みにする",
  UNPAID: "未入金に戻す",
  REFUNDED: "返金済みにする",
};

interface ApiBody {
  ok?: boolean;
  alreadyUpdated?: boolean;
  paymentStatus?: PaymentStatus;
  message?: string;
}

export function PaymentUpdateControl({
  tournamentId,
  entryId,
  realName,
  paymentStatus,
  entryStatus,
}: {
  tournamentId: string;
  entryId: string;
  realName: string;
  paymentStatus: PaymentStatus;
  entryStatus: EntryStatus;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<PaymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const inFlight = useRef(false);

  const actions = allowedPaymentActions(paymentStatus, entryStatus);
  const closeToast = useCallback(() => setToast(null), []);

  async function submit() {
    // 同期的に二重送信を防ぐ（15.27）。
    if (inFlight.current || !target) return;
    inFlight.current = true;
    setBusy(true);
    const to = target;
    try {
      const res = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/entries/${encodeURIComponent(entryId)}/payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, expectedFrom: paymentStatus }),
        },
      );
      let body: ApiBody = {};
      try {
        body = (await res.json()) as ApiBody;
      } catch {
        // 本文なし
      }
      if (res.ok && body.ok) {
        setToast({
          type: "success",
          message: body.alreadyUpdated
            ? (body.message ?? "既に更新済みです。")
            : `入金状況を「${PAYMENT_LABEL[body.paymentStatus ?? to]}」に更新しました。`,
        });
        router.refresh();
      } else {
        setToast({
          type: "error",
          message: body.message ?? "入金状況を更新できませんでした。",
        });
        // 他の操作で更新済みの場合などに最新状態を反映する。
        if (res.status === 409) router.refresh();
      }
    } catch {
      setToast({ type: "error", message: "通信に失敗しました。時間をおいて再度お試しください。" });
    } finally {
      inFlight.current = false;
      setBusy(false);
      setTarget(null);
    }
  }

  return (
    <>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((to) => (
            <button
              key={to}
              type="button"
              disabled={busy}
              onClick={() => setTarget(to)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {ACTION_LABEL[to]}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={target !== null}
        title="入金状況を更新しますか？"
        confirmLabel="更新する"
        cancelLabel="キャンセル"
        busy={busy}
        onConfirm={submit}
        onCancel={() => setTarget(null)}
        description={
          <span>
            {realName}：{PAYMENT_LABEL[paymentStatus]} → {target ? PAYMENT_LABEL[target] : ""}
          </span>
        }
      >
        {target === "REFUNDED" && (
          <p className="text-xs text-slate-500">
            返金済みは記録のみです。返金の金銭的な処理は行われません。
          </p>
        )}
      </ConfirmDialog>

      <Toast toast={toast} onClose={closeToast} durationMs={4000} />
    </>
  );
}
