// 大会一覧表（Table ビュー）。
// 行クリックで要項ビューアを開く。チェックボックスで一括エントリー選択。
"use client";

import { ArrowUp, ArrowDown, SearchX, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CapacityBadge,
  CategoryBadge,
  LifecycleBadge,
  TierBadge,
} from "@/features/tournaments/components/badges";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { SortOrder } from "@/features/tournaments/hooks/useTournamentFilters";

type Props = {
  tournaments: TournamentCardData[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onRowClick: (index: number) => void;
  sortOrder: SortOrder;
  onToggleSort: () => void;
  onResetFilters: () => void;
};

// 一括選択の対象になり得るか（受付中かつ満員でない・未来）。
function isSelectable(t: TournamentCardData): boolean {
  return t.status === "OPEN" && !t.isPast && t.capacityStatus !== "FULL" && !t.isEntered;
}

export function ScheduleTable({
  tournaments,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  sortOrder,
  onToggleSort,
  onResetFilters,
}: Props) {
  const selectableAll = tournaments.filter(isSelectable);
  const allSelected =
    selectableAll.length > 0 &&
    selectableAll.every((t) => selectedIds.has(t.id));

  if (tournaments.length === 0) {
    return <EmptyState onReset={onResetFilters} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse sm:min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500">
              <th className="py-3 px-2 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  aria-label="表示中の申込可能な大会を全選択"
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer"
                />
              </th>
              <th
                onClick={onToggleSort}
                className="py-3 px-2 w-20 sm:w-28 text-center cursor-pointer hover:bg-slate-100 transition select-none"
              >
                <div className="inline-flex items-center justify-center gap-0.5">
                  <span>日程</span>
                  {sortOrder === "asc" ? (
                    <ArrowUp className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-emerald-600" />
                  )}
                </div>
              </th>
              <th className="py-3 px-2 sm:px-3">大会名・会場</th>
              <th className="hidden sm:table-cell py-3 px-2.5 w-16">階級</th>
              <th className="hidden md:table-cell py-3 px-3 w-40">会場</th>
              <th className="py-3 px-2 sm:px-3 w-24 sm:w-32 text-center">
                申込状況
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {tournaments.map((t, index) => {
              const canAct = t.status === "OPEN" && !t.isPast;
              const selectable = isSelectable(t);
              return (
                <tr
                  key={t.id}
                  onClick={() => onRowClick(index)}
                  className="hover:bg-slate-50 transition cursor-pointer"
                >
                  <td
                    className="py-3 px-2 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      disabled={!selectable}
                      checked={selectedIds.has(t.id)}
                      onChange={() => onToggleSelect(t.id)}
                      aria-label={`${t.title} を一括エントリーに選択`}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-3 px-2 text-center whitespace-nowrap">
                    <div className="font-bold text-slate-900 tabular-nums">
                      {t.eventDate.slice(5).replace("-", "/")}
                    </div>
                    <div className="text-xs text-slate-400 tabular-nums">
                      {t.startTime}
                    </div>
                  </td>
                  <td className="py-3 px-2 sm:px-3">
                    <div className="font-bold text-slate-900 line-clamp-1">
                      {t.title}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <CategoryBadge
                        category={t.category}
                        className="scale-90 origin-left"
                      />
                      <span className="text-xs text-slate-400 truncate sm:hidden">
                        {t.venue}
                      </span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell py-3 px-2.5">
                    <TierBadge tier={t.tier} />
                  </td>
                  <td className="hidden md:table-cell py-3 px-3 text-slate-600">
                    {t.venue}
                  </td>
                  <td className="py-3 px-2 sm:px-3 text-center">
                    {canAct ? (
                      <CapacityBadge
                        status={t.capacityStatus}
                        isEntered={t.isEntered}
                        className="scale-90"
                      />
                    ) : (
                      <LifecycleBadge status={t.status} className="scale-90" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center space-y-2">
      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
        <SearchX className="w-6 h-6" />
      </div>
      <p className="text-xs font-bold text-slate-600">
        条件に合致する大会が見つかりませんでした
      </p>
      <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
        <Calendar className="w-3.5 h-3.5" />
        月・種目・検索キーワードを変更してお試しください
      </p>
      <button
        onClick={onReset}
        className="mt-2 px-3 min-h-[44px] rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
      >
        フィルターをリセット
      </button>
    </div>
  );
}
