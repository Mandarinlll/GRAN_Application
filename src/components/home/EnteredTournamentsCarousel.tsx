// エントリー済み大会を「1件ずつ」表示し、左右ボタンでめくれるカルーセル。
// 元 home.html の #entered-tournaments-section と、そのJS(prevTournament/nextTournament)を移植。
"use client";

// useState は React の機能。「変化する値（状態）」を扱うために使う。
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EnteredTournament } from "@/types/home";

type Props = {
  tournaments: EnteredTournament[]; // 表示する大会の配列（複数件）
};

export function EnteredTournamentsCarousel({ tournaments }: Props) {
  // currentIndex = 今表示している大会が配列の何番目か（0 始まり）。
  // setCurrentIndex を呼ぶと値が更新され、画面が自動で描き直される。
  const [currentIndex, setCurrentIndex] = useState(0);

  // データが1件も無いときは何も出さない（早期リターン）。
  if (tournaments.length === 0) return null;

  const total = tournaments.length;
  const current = tournaments[currentIndex]; // 今表示中の1件

  // 「前へ」ボタン: index を1減らす。0未満にならないよう Math.max で止める。
  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  // 「次へ」ボタン: index を1増やす。最後を超えないよう Math.min で止める。
  const goNext = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  return (
    <div className="space-y-3">
      {/* セクション見出し + 「1 / 2」のページ表示 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">
          エントリー済みの大会
        </h3>
        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* カルーセル本体 */}
      <div className="relative max-w-sm mx-auto px-2">
        {/* 前へボタン。先頭(index 0)のときは押せないよう disabled にする */}
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="前の大会"
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:text-emerald-700 flex items-center justify-center z-20 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* 大会カード（今表示中の1件を出す） */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-100 text-amber-800 border-amber-300">
              {current.statusLabel}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {current.displayId}
            </span>
          </div>

          <h4 className="text-base font-extrabold text-slate-900 leading-snug">
            {current.title}
          </h4>

          {/* 大会の詳細情報を並べる。ラベルと値のペア。 */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
            <InfoRow label="開催日時" value={current.dateTime} />
            <InfoRow label="会場" value={current.venue} />
            <InfoRow label="種目 / 規定階級" value={current.categoryLevel} />
            <InfoRow label="参加費用" value={current.fee} />
            <InfoRow label="エントリー" value={current.applicantInfo} last />
          </div>

          {/* 注意事項 */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] leading-relaxed text-amber-800">
            {current.note}
          </div>
        </div>

        {/* 次へボタン。最後のときは押せない */}
        <button
          onClick={goNext}
          disabled={currentIndex === total - 1}
          aria-label="次の大会"
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:text-emerald-700 flex items-center justify-center z-20 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* ドットインジケーター（今が何枚目か点で示す） */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {/* tournaments.map(...) で「配列の各要素をドットに変換」して並べる。
            _t は使わないので慣習的にアンダースコア。index を使う。 */}
        {tournaments.map((_t, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            aria-label={`${index + 1}番目の大会へ`}
            className={
              index === currentIndex
                ? "w-2.5 h-2.5 rounded-full bg-emerald-600"
                : "w-2.5 h-2.5 rounded-full bg-slate-300 hover:bg-slate-400"
            }
          />
        ))}
      </div>
    </div>
  );
}

// この小さな部品はこのファイル内だけで使う（export しない）。
// 「ラベル: 値」の1行を表示する。last=true のときは下線を消す。
function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={
        last
          ? "flex justify-between items-center py-0.5"
          : "flex justify-between items-center py-0.5 border-b border-slate-200/60"
      }
    >
      <span className="text-slate-500 text-[11px]">{label}</span>
      <span className="font-bold text-slate-900 text-right">{value}</span>
    </div>
  );
}
