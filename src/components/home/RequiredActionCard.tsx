// 「要対応」カード1件を表示する部品。
// 元 home.html の #reminder-box を移植。緊急度(urgency)で色を出し分ける。
"use client";

import { AlertCircle, Clock, Calendar, ArrowRight } from "lucide-react";
import type { RequiredAction } from "@/types/home";

type Props = {
  action: RequiredAction; // 表示する要対応データ1件
};

// 緊急度ごとの色クラスをまとめた「早見表」。
// urgency の値をキーにして、対応する色クラスを取り出す。
// こうしておくと JSX の中が if だらけにならず読みやすい。
const urgencyStyles = {
  danger: {
    border: "border-rose-300",
    badge: "bg-rose-500 text-white",
    timeText: "text-rose-800 bg-rose-100 border-rose-300",
    timeIcon: "text-rose-600",
    button: "bg-rose-600 hover:bg-rose-700",
  },
  warning: {
    border: "border-amber-300",
    badge: "bg-amber-500 text-white",
    timeText: "text-amber-800 bg-amber-100 border-amber-300",
    timeIcon: "text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  normal: {
    border: "border-emerald-300",
    badge: "bg-emerald-500 text-white",
    timeText: "text-emerald-800 bg-emerald-100 border-emerald-300",
    timeIcon: "text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
} as const;
// as const は「この表の中身は変更しない定数だよ」と TypeScript に伝える印。

export function RequiredActionCard({ action }: Props) {
  // action.urgency（"danger" など）に対応する色セットを取り出す。
  const style = urgencyStyles[action.urgency];

  return (
    <div
      // テンプレートリテラル（バッククォート）で、固定のクラスと
      // 上で選んだ style.border を1つの文字列に結合している。
      className={`relative overflow-hidden rounded-2xl bg-white border-2 ${style.border} p-4 sm:p-5 shadow-md`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 左側: バッジ・残り時間・大会名・必要な対応 */}
        <div className="space-y-2.5 flex-1 min-w-0">
          {/* 上部: 要対応バッジ + 残り時間 */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black ${style.badge}`}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>要対応</span>
            </span>

            <div
              className={`inline-flex items-center gap-1.5 text-xs font-extrabold border px-2.5 py-1 rounded-lg ${style.timeText}`}
            >
              <Clock className={`w-3.5 h-3.5 ${style.timeIcon}`} />
              <span>残り {action.daysLeft}日</span>
            </div>
          </div>

          {/* 大会日 & 大会名 */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>大会日: {action.tournamentDate}</span>
            </div>
            <h4 className="text-base font-extrabold text-slate-900 leading-snug tracking-tight">
              {action.tournamentTitle}
            </h4>
          </div>

          {/* 必要な対応 */}
          <div className="inline-flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5">
            <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-3 h-3" />
            </div>
            <div className="font-bold text-slate-800">
              <span className="text-rose-700 font-extrabold mr-1.5">
                必要な対応:
              </span>
              <span>{action.actionLabel}</span>
            </div>
          </div>
        </div>

        {/* 右側: アクションボタン */}
        <div className="flex-shrink-0 flex items-center sm:self-center">
          <button
            onClick={() => alert("メンバー登録変更画面へ遷移します")}
            className={`w-full sm:w-auto h-11 px-6 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 ${style.button}`}
          >
            <span>対応する</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
