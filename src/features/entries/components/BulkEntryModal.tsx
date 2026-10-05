// 一括エントリー申込モーダル。
// 選択中の複数大会へ、同一メンバー構成でまとめて申込む。
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Layers, AlertCircle, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitBulkEntryAction } from "@/features/entries/server/actions";
import { formatYen } from "@/utils/date";
import { CategoryBadge, TierBadge } from "@/features/tournaments/components/badges";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { EntryViewer } from "@/features/entries/server/entryViewData";

type Props = {
  tournaments: TournamentCardData[]; // 選択中の大会
  viewer: EntryViewer;
  onRemove: (id: string) => void;
  onClose: () => void;
  onDone: (okCount: number, total: number) => void;
  onToast: (message: string, type: "success" | "error") => void;
};

export function BulkEntryModal({
  tournaments,
  viewer,
  onRemove,
  onClose,
  onDone,
  onToast,
}: Props) {
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalFee = useMemo(
    () => tournaments.reduce((sum, t) => sum + t.entryFee, 0),
    [tournaments],
  );

  // 同日開催の重複を検知（警告表示）。
  const dayConflict = useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of tournaments) {
      seen.set(t.eventDate, (seen.get(t.eventDate) ?? 0) + 1);
    }
    return [...seen.values()].some((c) => c > 1);
  }, [tournaments]);

  // 団体戦/ダブルスを含むか（チーム必須）。
  const needsTeam = tournaments.some(
    (t) => t.category !== "SINGLES",
  );

  async function handleSubmit() {
    if (!agree) {
      onToast("参加規約・キャンセルポリシーへの同意が必要です", "error");
      return;
    }
    if (tournaments.length === 0) return;
    setSubmitting(true);
    const res = await submitBulkEntryAction({
      tournamentIds: tournaments.map((t) => t.id),
      teamId: needsTeam ? viewer.team?.id : undefined,
      members: [], // シングルス主体の一括申込を想定（団体戦は後からメンバー調整）
      acknowledgeConflict: acknowledged,
      agreeTerms: agree,
    });
    setSubmitting(false);

    const okCount = res.results?.filter((r) => r.ok).length ?? 0;
    // 失敗が含まれる場合は詳細をトーストで知らせる。
    if (okCount < tournaments.length) {
      const firstFail = res.results?.find((r) => !r.ok);
      onToast(
        `${okCount}/${tournaments.length}件完了。${firstFail?.message ?? ""}`,
        okCount > 0 ? "success" : "error",
      );
    }
    onDone(okCount, tournaments.length);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">一括エントリー申込</h3>
              <div className="text-xs text-slate-400">複数大会まとめ申込</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 選択中の大会 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>選択中の大会 ({tournaments.length}件)</span>
              <span className="text-xs text-slate-400 font-normal">
                ※✕で個別に除外
              </span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CategoryBadge
                        category={t.category}
                        className="scale-90 origin-left"
                      />
                      <TierBadge tier={t.tier} className="scale-90 origin-left" />
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {t.title}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {t.eventDateLabel} · {t.entryFeeLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(t.id)}
                    aria-label={`${t.title} を除外`}
                    className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 同日重複警告 */}
          {dayConflict && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <div className="font-bold text-rose-950">
                  同日開催大会の重複選択
                </div>
                <p className="leading-relaxed">
                  同じ開催日の大会が複数選択されています。重複参加にならないかご確認ください。
                </p>
                <label className="flex items-center gap-1.5 pt-1 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span>確認しました</span>
                </label>
              </div>
            </div>
          )}

          {/* 合計金額 */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-900">
                合計エントリー参加費用
              </div>
              <div className="text-xs text-emerald-700">
                {tournaments.length}大会分の参加費合計
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
              {formatYen(totalFee)}
            </div>
          </div>

          <label className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 mt-0.5"
            />
            <span className="leading-relaxed">
              全選択大会の参加規約およびキャンセルポリシーに同意の上、一括エントリー申込を行います
            </span>
          </label>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            isLoading={submitting}
            disabled={submitting || tournaments.length === 0}
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            一括エントリーを確定する
          </Button>
        </div>
      </div>
    </div>
  );
}
