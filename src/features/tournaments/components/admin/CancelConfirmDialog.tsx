// 大会中止の確認ダイアログ。開いた時点で /cancel-impact から 4 件数を取得して表示する（Requirement 7.1, 7.2, 7.13）。
"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { CancelImpact } from "@/features/tournaments/types/adminTournament";

type Props = {
  open: boolean;
  tournamentId: string;
  tournamentTitle: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; impact: CancelImpact };

export function CancelConfirmDialog({
  open,
  tournamentId,
  tournamentTitle,
  onConfirm,
  onCancel,
}: Props) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/cancel-impact`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          impact?: CancelImpact;
          message?: string;
        } | null;
        if (!alive) return;
        if (res.ok && json?.ok && json.impact) {
          setState({ kind: "ready", impact: json.impact });
        } else {
          setState({
            kind: "error",
            message: json?.message ?? "影響件数を取得できませんでした。",
          });
        }
      } catch {
        if (alive) setState({ kind: "error", message: "影響件数を取得できませんでした。" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, tournamentId]);

  const ready = state.kind === "ready";

  return (
    <ConfirmDialog
      open={open}
      title="大会を中止しますか？"
      description={`「${tournamentTitle}」を中止します。この操作は元に戻せません。`}
      confirmLabel="中止する"
      variant="destructive"
      busy={!ready}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {state.kind === "loading" && <p className="text-slate-500">件数を取得しています…</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-rose-600">
          {state.message}
        </p>
      )}
      {state.kind === "ready" && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 tabular-nums">
            <Count label="確定エントリー" value={state.impact.confirmedCount} />
            <Count label="キャンセル待ち" value={state.impact.waitingCount} />
            <Count label="請求中のキャンセル" value={state.impact.billingCancellationCount} />
            <Count label="入金済みエントリー" value={state.impact.paidCount} />
          </dl>
          <p className="text-xs text-slate-500">
            キャンセル待ちは失効し、請求中のキャンセルは取り下げられ、確定エントリーの代表者へ中止通知が送られます。
          </p>
          {state.impact.paidCount >= 1 && (
            <p
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-800"
            >
              入金済みのエントリーが {state.impact.paidCount} 件あります。返金処理は本機能では行われません。
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-bold text-slate-900">{value}件</dd>
    </div>
  );
}
