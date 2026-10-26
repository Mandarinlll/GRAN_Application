// キャンセル待ち申込モーダル（満員大会）。
"use client";

import { useEffect } from "react";
import { X, Clock, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitWaitlistAction } from "@/features/entries/server/actions";
import { requiresTeam } from "@/features/tournaments/utils/category";
import { TierBadge } from "@/features/tournaments/components/badges";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { EntryViewer } from "@/features/entries/server/entryViewData";
import { useState } from "react";

type Props = {
  tournament: TournamentCardData;
  viewer: EntryViewer;
  onClose: () => void;
  onSuccess: (queueNumber: number | undefined, tournament: TournamentCardData) => void;
  onToast: (message: string, type: "success" | "error") => void;
};

export function WaitlistModal({ tournament, viewer, onClose, onSuccess, onToast }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const needsTeam = requiresTeam(tournament.category);
  // このまま申し込んだ場合の待機順位（現在の待機人数 + 1）。
  const nextQueue = tournament.waitingCount + 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await submitWaitlistAction({
      tournamentId: tournament.id,
      teamId: needsTeam ? viewer.team?.id : undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      onToast(res.message ?? "登録に失敗しました", "error");
      return;
    }
    onSuccess(res.queueNumber, tournament);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">キャンセル待ち申込</h3>
              <div className="text-xs text-slate-400">満員大会 順番待ち登録</div>
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-600 text-white">
                満員 (キャンセル待ち受付中)
              </span>
              <TierBadge tier={tournament.tier} />
            </div>
            <h4 className="text-base font-bold text-slate-900 leading-snug">
              {tournament.title}
            </h4>
            <div className="text-xs text-slate-600 tabular-nums">
              {tournament.eventDateLabel} · {tournament.venue}
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-950">
            <div className="font-bold flex items-center gap-1.5 text-amber-900 text-sm">
              <Users className="w-4 h-4 text-amber-600" />
              <span>現在の待機状況</span>
            </div>
            <p className="leading-relaxed">
              現在{" "}
              <span className="font-bold tabular-nums">
                {tournament.waitingCount}
              </span>{" "}
              件が待機中です。このまま申し込むと、あなたは{" "}
              <span className="font-bold text-rose-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 tabular-nums">
                第{nextQueue}番目
              </span>{" "}
              の待機順位となります。
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Info className="w-4 h-4 text-emerald-600" />
              <span>繰り上がりの仕組み</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 leading-relaxed">
              <li>
                空き枠が発生した場合、順番待ち最上位へ自動案内が届きます（通知はシステム記録のみ）。
              </li>
              <li>案内送信後、24時間以内に承諾することで確定枠に昇格します。</li>
              <li>期限が切れた場合は自動的に次点者へ繰り上がります。</li>
            </ul>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            戻る
          </Button>
          <Button
            variant="destructive"
            size="md"
            type="button"
            isLoading={submitting}
            disabled={submitting}
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial"
          >
            <Clock className="w-4 h-4 mr-1.5" />
            キャンセル待ちに登録する (#{nextQueue})
          </Button>
        </div>
      </div>
    </div>
  );
}
