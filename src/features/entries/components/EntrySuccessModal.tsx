// エントリー完了 / キャンセル待ち登録完了モーダル。
"use client";

import { CheckCircle2, Clock, Mail, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TournamentCardData } from "@/features/tournaments/types/view";

type Props = {
  kind: "entry" | "waitlist";
  tournament: TournamentCardData;
  queueNumber?: number;
  onClose: () => void;
  onOpenEntered: () => void;
};

export function EntrySuccessModal({
  kind,
  tournament,
  queueNumber,
  onClose,
  onOpenEntered,
}: Props) {
  const isWaitlist = kind === "waitlist";

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 my-auto text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
            isWaitlist
              ? "bg-amber-100 text-amber-600"
              : "bg-emerald-100 text-emerald-600"
          }`}
        >
          {isWaitlist ? (
            <Clock className="w-9 h-9" />
          ) : (
            <CheckCircle2 className="w-9 h-9" />
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">
            {isWaitlist
              ? "キャンセル待ちの受付が完了しました"
              : "エントリー申込が完了しました"}
          </h3>
          <p className="text-xs text-slate-500">
            {isWaitlist
              ? "待機キューへの登録が完了しました"
              : "大会へのエントリー受付を正常に完了しました"}
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
          {isWaitlist && queueNumber != null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-bold">待機キュー順位:</span>
              <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                #{queueNumber}
              </span>
            </div>
          )}
          <div className="space-y-1 text-xs">
            <div className="font-bold text-slate-800">{tournament.title}</div>
            <div className="text-xs text-slate-500 tabular-nums">
              {tournament.eventDateLabel} · {tournament.venue}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-left space-y-1">
          <div className="font-bold text-emerald-900 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-emerald-600" />
            <span>通知について</span>
          </div>
          <p>
            {isWaitlist
              ? "空き枠が発生した際に繰り上がり承諾案内メールをお届けします（通知はシステム記録のみ・実送信は今後対応）。"
              : "エントリー確認メールを記録しました（実送信は今後対応）。メンバーの差し替えや未定枠の確定は開催3日前まで行えます。"}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <Button variant="primary" size="full" onClick={onOpenEntered} type="button">
            <Bookmark className="w-4 h-4 mr-1.5" />
            自チーム申込中大会一覧で確認する
          </Button>
          <Button variant="secondary" size="full" onClick={onClose} type="button">
            大会日程一覧へ戻る
          </Button>
        </div>
      </div>
    </div>
  );
}
