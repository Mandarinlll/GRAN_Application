// エントリーキャンセル申請モーダル。
// 開催日までの残日数からキャンセル料率を自動判定して表示し、確定する。
"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelEntryAction } from "@/features/entries/server/actions";
import { calculateCancelFee } from "@/features/entries/utils/cancelFee";
import { formatEventDate, formatYen } from "@/utils/date";
import type { EntrySummary } from "@/features/entries/types/entry";

type Props = {
  entry: EntrySummary;
  onClose: () => void;
  onDone: (message: string) => void;
  onToast: (message: string, type: "success" | "error") => void;
};

export function CancelEntryModal({ entry, onClose, onDone, onToast }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const fee = calculateCancelFee(entry.eventDate, entry.entryFee);

  async function handleConfirm() {
    setSubmitting(true);
    const res = await cancelEntryAction({ entryId: entry.entryId });
    setSubmitting(false);
    if (!res.ok) {
      onToast(res.message ?? "キャンセルに失敗しました", "error");
      return;
    }
    onDone(res.message ?? "キャンセルを受け付けました");
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/80 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 my-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              エントリーのキャンセル申請
            </h3>
            <p className="text-xs text-slate-500">キャンセル料率の自動判定・確定</p>
          </div>
        </div>

        {/* 対象大会 */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
          <div className="font-bold text-slate-800">{entry.tournamentTitle}</div>
          <div className="text-xs text-slate-500 tabular-nums">
            {formatEventDate(entry.eventDate)}
          </div>
        </div>

        {/* 料率試算 */}
        <div
          className={cn(
            "p-3.5 rounded-xl border space-y-2 text-xs",
            fee.feeRate === 0 && "bg-emerald-50 border-emerald-200",
            fee.feeRate === 50 && "bg-amber-50 border-amber-200",
            fee.feeRate === 100 && "bg-rose-50 border-rose-200",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-bold">開催までの日数:</span>
            <span className="font-bold tabular-nums">残り {fee.daysBefore}日</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-bold">適用キャンセル料率:</span>
            <span
              className={cn(
                "font-bold text-sm tabular-nums",
                fee.feeRate === 0 && "text-emerald-700",
                fee.feeRate === 50 && "text-amber-700",
                fee.feeRate === 100 && "text-rose-700",
              )}
            >
              {fee.feeRate}% {fee.feeRate === 0 ? "(無料)" : "発生"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
            <span className="font-bold text-slate-800">ご請求キャンセル料:</span>
            <span className="font-bold text-base text-rose-600 tabular-nums">
              {formatYen(fee.feeAmount)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          ※キャンセルを確定すると直ちに枠が解放されます。この操作は取り消せません。
          {fee.isPaid &&
            "（有償キャンセルのため、管理者より請求のご連絡をいたします）"}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            type="button"
            className="flex-1"
          >
            やめる
          </Button>
          <Button
            variant="destructive"
            size="md"
            type="button"
            isLoading={submitting}
            disabled={submitting}
            onClick={handleConfirm}
            className="flex-1"
          >
            キャンセルを確定する
          </Button>
        </div>
      </div>
    </div>
  );
}
