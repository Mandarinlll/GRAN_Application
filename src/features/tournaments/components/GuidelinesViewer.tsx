// 大会要項ビューア（詳細モーダル）。
// requirements-detail-user.md 2.2 準拠：
//  - 要項写真（タップで全画面）＋ 重要情報はすべて HTML テキストで明記
//  - 枠の空き状況に応じて「エントリー申込」or「キャンセル待ち申込」CTA
//  - 前後の大会へ ← → キーで移動
"use client";

import { useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Users,
  Wallet,
  Edit3,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CapacityBadge,
  CategoryBadge,
  LifecycleBadge,
  TierBadge,
} from "@/features/tournaments/components/badges";
import { FlyerPlaceholder } from "@/features/tournaments/components/FlyerPlaceholder";
import { memberCountRange } from "@/features/tournaments/utils/category";
import { formatTime } from "@/utils/date";
import type { TournamentCardData } from "@/features/tournaments/types/view";

type Props = {
  tournaments: TournamentCardData[]; // フィルター後の配列（前後送り対象）
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  onOpenFlyer: (tournament: TournamentCardData) => void;
  onEntry: (tournament: TournamentCardData) => void;
  onWaitlist: (tournament: TournamentCardData) => void;
};

export function GuidelinesViewer({
  tournaments,
  index,
  onIndexChange,
  onClose,
  onOpenFlyer,
  onEntry,
  onWaitlist,
}: Props) {
  const t = tournaments[index];

  // ← → / ESC キー操作。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < tournaments.length - 1)
        onIndexChange(index + 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, tournaments.length, onClose, onIndexChange]);

  if (!t) return null;

  const isFull = t.capacityStatus === "FULL";
  const isOpen = t.status === "OPEN";
  const canAct = isOpen && !t.isPast;
  const range = memberCountRange(t.category, t.teamSizeMin, t.teamSizeMax);
  const pct = Math.min(
    100,
    Math.round((t.confirmedCount / Math.max(1, t.capacity)) * 100),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* トップバー: 前後送り + インジケーター + 閉じる */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <button
            onClick={() => index > 0 && onIndexChange(index - 1)}
            disabled={index <= 0}
            className="flex items-center gap-1.5 px-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">前の要項</span>
          </button>

          <div className="text-center px-2 min-w-0">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white tabular-nums">
              {index + 1} / {tournaments.length}
            </span>
            <p className="text-xs text-slate-300 font-bold truncate mt-0.5">
              {t.title}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                index < tournaments.length - 1 && onIndexChange(index + 1)
              }
              disabled={index >= tournaments.length - 1}
              className="flex items-center gap-1.5 px-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">次の要項</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 左: 要項写真（タップで全画面） */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <button
                onClick={() => onOpenFlyer(t)}
                aria-label="要項を全画面表示"
                className="w-full max-w-[240px] sm:max-w-[260px] aspect-[9/16] max-h-[min(480px,60vh)] rounded-xl overflow-hidden shadow-md border border-slate-200 bg-slate-900 relative group transition-transform hover:scale-[1.01]"
              >
                {t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.imageUrl}
                    alt={`${t.title} の要項ポスター`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FlyerPlaceholder tournament={t} />
                )}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </button>
            </div>

            {/* 右: テキスト情報 */}
            <div className="lg:col-span-7 space-y-4">
              {/* バッジ + タイトル */}
              <div className="space-y-1.5 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge category={t.category} />
                  <TierBadge tier={t.tier} />
                  {canAct ? (
                    <CapacityBadge
                      status={t.capacityStatus}
                      isEntered={t.isEntered}
                    />
                  ) : (
                    <LifecycleBadge status={t.status} />
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                  {t.title}
                </h3>
              </div>

              {/* スペックグリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <SpecCell
                  icon={Calendar}
                  label="開催日程"
                  main={t.eventDateLabel}
                  sub={`${formatTime(t.startTime)} 開始${
                    t.endTime ? ` (${formatTime(t.endTime)} 終了予定)` : ""
                  }`}
                />
                <SpecCell
                  icon={MapPin}
                  label="会場・コート"
                  main={t.venue}
                  sub={t.courtInfo ?? "—"}
                />
                <SpecCell
                  icon={Users}
                  label="種目・参加資格"
                  main={
                    t.category === "SINGLES"
                      ? "シングルス（個人戦）"
                      : t.category === "DOUBLES"
                        ? "ダブルス（2名）"
                        : `団体戦（${range.min}${range.max !== range.min ? `〜${range.max}` : ""}名）`
                  }
                  sub={`対象階級: ${t.tier}級`}
                />
                <SpecCell
                  icon={Wallet}
                  label="参加費用"
                  main={t.entryFeeLabel}
                  mainClass="text-emerald-600"
                  sub="管理画面での請求・振込確認運用"
                />
              </div>

              {/* 詳細テキスト */}
              {t.description && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="font-bold text-slate-800">大会要項・競技規則</div>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {t.description}
                  </p>
                </div>
              )}

              {/* 空き状況プログレスバー */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600">エントリー枠の空き状況</span>
                  <span className="text-emerald-600 tabular-nums">
                    確定 {t.confirmedCount}枠 / 定員 {t.capacity}枠 (残り {t.remaining}枠)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isFull
                        ? "bg-rose-500"
                        : t.capacityStatus === "FEW"
                          ? "bg-amber-500"
                          : "bg-emerald-600",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {t.waitingCount > 0 && (
                  <div className="text-xs text-slate-400 tabular-nums">
                    キャンセル待ち: {t.waitingCount}件
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* フッターCTA */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose} type="button" className="w-full sm:w-auto">
            閉じる
          </Button>
          {canAct ? (
            isFull ? (
              <Button
                variant="destructive"
                size="md"
                type="button"
                onClick={() => onWaitlist(t)}
                className="w-full sm:w-auto"
              >
                <Clock className="w-4 h-4 mr-1.5" />
                キャンセル待ち申込
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={() => onEntry(t)}
                className="w-full sm:w-auto"
              >
                <Edit3 className="w-4 h-4 mr-1.5" />
                この大会にエントリー申込
              </Button>
            )
          ) : (
            <Button variant="secondary" size="md" type="button" disabled className="w-full sm:w-auto">
              受付対象外
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecCell({
  icon: Icon,
  label,
  main,
  sub,
  mainClass,
}: {
  icon: typeof Calendar;
  label: string;
  main: string;
  sub: string;
  mainClass?: string;
}) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
      <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
        <Icon className="w-3 h-3 text-emerald-600" />
        {label}
      </div>
      <div className={cn("font-bold text-slate-900 text-sm", mainClass)}>
        {main}
      </div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
