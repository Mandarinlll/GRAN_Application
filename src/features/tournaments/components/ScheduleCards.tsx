// 大会カードグリッド（Cards ビュー）。
// カードクリックで要項ビューアを開く。上部のチェックで一括選択。
"use client";

import { Calendar, MapPin, SearchX } from "lucide-react";
import {
  CategoryBadge,
  TierBadge,
} from "@/features/tournaments/components/badges";
import { CapacityMeter } from "@/features/tournaments/components/CapacityMeter";
import { FlyerPlaceholder } from "@/features/tournaments/components/FlyerPlaceholder";
import type { TournamentCardData } from "@/features/tournaments/types/view";

type Props = {
  tournaments: TournamentCardData[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onCardClick: (index: number) => void;
  onResetFilters: () => void;
};

function isSelectable(t: TournamentCardData): boolean {
  return t.status === "OPEN" && !t.isPast && t.capacityStatus !== "FULL" && !t.isEntered;
}

export function ScheduleCards({
  tournaments,
  selectedIds,
  onToggleSelect,
  onCardClick,
  onResetFilters,
}: Props) {
  if (tournaments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <SearchX className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-slate-600">
          条件に合致する大会が見つかりませんでした
        </p>
        <button
          onClick={onResetFilters}
          className="mt-2 px-3 min-h-[44px] rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
        >
          フィルターをリセット
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tournaments.map((t, index) => {
        const selectable = isSelectable(t);
        return (
          <article
            key={t.id}
            onClick={() => onCardClick(index)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-emerald-200 transition flex flex-col"
          >
            {/* 要項写真。要項は 16:9（横長）で作成されるが、カードでは縦長の枠で
                大きく見せるため、枠をやや縦長（15:16）にして object-cover で中央を表示する。
                全体表示は要項ビューア（タップで展開）側で担保する。 */}
            <div className="relative aspect-[15/16] bg-slate-900 overflow-hidden">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.imageUrl}
                  alt={`${t.title} の要項`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FlyerPlaceholder tournament={t} variant="card" />
              )}
              {/* 一括選択チェック */}
              {selectable && (
                <label
                  className="absolute top-2 left-2 bg-white/90 rounded-lg p-1.5 shadow-sm cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => onToggleSelect(t.id)}
                    aria-label={`${t.title} を一括エントリーに選択`}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer block"
                  />
                </label>
              )}
            </div>

            {/* テキスト情報 */}
            <div className="p-3.5 space-y-2 flex-1 flex flex-col">
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={t.category} className="scale-90 origin-left" />
                <TierBadge tier={t.tier} className="scale-90 origin-left" />
              </div>
              <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
                {t.title}
              </h3>
              <div className="space-y-1 text-xs text-slate-600 mt-auto pt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-bold tabular-nums truncate">
                    {t.eventDateLabel} {t.startTime}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{t.venue}</span>
                </div>
              </div>

              {/* エントリー状況メーター（残り枠バー + 状況色分け） */}
              <CapacityMeter
                variant="compact"
                capacity={t.capacity}
                confirmedCount={t.confirmedCount}
                remaining={t.remaining}
                capacityStatus={t.capacityStatus}
                lifecycleStatus={t.status}
                isPast={t.isPast}
                isEntered={t.isEntered}
                waitingCount={t.waitingCount}
                className="pt-1"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
