// フローティング一括エントリーバー（1件以上選択時に画面下部中央へ出現）。
"use client";

import { ArrowRight } from "lucide-react";
import { formatYen } from "@/utils/date";

type Props = {
  count: number;
  totalFee: number;
  onClear: () => void;
  onProceed: () => void;
};

export function BulkEntryBar({ count, totalFee, onClear, onProceed }: Props) {
  if (count <= 0) return null;

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-xl px-4 sm:px-6 py-3 border border-slate-700 flex items-center justify-between gap-4 max-w-xl w-[92vw]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-bold tabular-nums shrink-0">
          {count}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold truncate">
            {count}大会を選択中
            <span className="text-emerald-400 ml-2 tabular-nums">
              {formatYen(totalFee)}
            </span>
          </div>
          <div className="text-xs text-slate-400 truncate">
            まとめて一括エントリーへ進めます
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onClear}
          className="px-2.5 min-h-[40px] rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          解除
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="px-3.5 sm:px-4 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md transition flex items-center gap-1.5"
        >
          <span>一括エントリーへ</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
