// 大会一覧のコントロールバー（KPIカード + 表示設定フィルター）。
"use client";

import {
  Calendar,
  UserCheck,
  Flame,
  Bookmark,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  ChevronDown,
  Table,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Search,
  Users,
  Trophy,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  type TournamentCategory,
  type TournamentTier,
} from "@/features/tournaments/types/tournament";
import type {
  FilterState,
  SortOrder,
  StatusFilter,
} from "@/features/tournaments/hooks/useTournamentFilters";

type ViewMode = "table" | "cards";

type Props = {
  kpi: { total: number; open: number; few: number; entered: number };
  filters: FilterState;
  update: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  reset: () => void;
  resultCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenEntered: () => void;
};

const CATEGORY_OPTIONS: TournamentCategory[] = [
  "MIX_TEAM",
  "MEN_TEAM",
  "WOMEN_TEAM",
  "SINGLES",
  "DOUBLES",
];
const TIER_OPTIONS: TournamentTier[] = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "すべての状況" },
  { value: "OPEN", label: "受付中 (空きあり)" },
  { value: "FEW", label: "残りわずか" },
  { value: "WAITLIST", label: "満員 (キャンセル待ち)" },
  { value: "ENTERED", label: "エントリー中のみ" },
];

export function ScheduleControls({
  kpi,
  filters,
  update,
  reset,
  resultCount,
  viewMode,
  onViewModeChange,
  onOpenEntered,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* KPIカード */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard
          icon={Calendar}
          iconClass="bg-emerald-50 text-emerald-600"
          label="掲載大会数"
          value={kpi.total}
          valueClass="text-slate-900"
        />
        <KpiCard
          icon={UserCheck}
          iconClass="bg-sky-50 text-sky-600"
          label="受付中"
          value={kpi.open}
          valueClass="text-sky-600"
        />
        <KpiCard
          icon={Flame}
          iconClass="bg-amber-50 text-amber-600"
          label="残りわずか"
          value={kpi.few}
          valueClass="text-amber-600"
        />
        <button
          type="button"
          onClick={onOpenEntered}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3 hover:border-purple-300 hover:shadow-md transition group text-left min-h-[44px]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-500">自チーム申込中</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-bold text-purple-600 tabular-nums">
                  {kpi.entered}
                </span>
                <span className="text-xs text-slate-400 font-bold">大会</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-600 shrink-0" />
        </button>
      </section>

      {/* コントロールバー */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <span>表示設定</span>
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 tabular-nums">
              {resultCount}件表示（
              {filters.sortOrder === "asc" ? "昇順" : "降順"}）
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* ビュー切替 */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 min-h-[44px] rounded-lg text-xs font-bold transition",
                  viewMode === "table"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">一覧表</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 min-h-[44px] rounded-lg text-xs font-bold transition",
                  viewMode === "cards"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">カード</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="px-3 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              <span>{settingsOpen ? "表示設定を閉じる" : "表示設定を開く"}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform",
                  settingsOpen && "rotate-180",
                )}
              />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className="border-t border-slate-100 p-3.5 sm:p-5 space-y-3.5 bg-slate-50/50">
            {/* 上段: 終了済トグル・昇順降順・リセット */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/60">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <label className="inline-flex items-center gap-1.5 px-2.5 min-h-[44px] rounded-xl bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer text-xs font-bold text-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={filters.includeFinished}
                    onChange={(e) => update("includeFinished", e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300"
                  />
                  <span>終了済の大会も表示</span>
                </label>

                <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-xl text-xs font-bold">
                  <SortBtn
                    active={filters.sortOrder === "desc"}
                    onClick={() => update("sortOrder", "desc" as SortOrder)}
                    icon={ArrowDown}
                    label="降順"
                  />
                  <SortBtn
                    active={filters.sortOrder === "asc"}
                    onClick={() => update("sortOrder", "asc" as SortOrder)}
                    icon={ArrowUp}
                    label="昇順"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={reset}
                className="text-xs text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 transition min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>条件をリセット</span>
              </button>
            </div>

            {/* フィルター群 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* 月 */}
              <FilterField icon={Calendar} iconClass="text-emerald-600" label="開催月">
                <select
                  value={String(filters.month)}
                  onChange={(e) =>
                    update(
                      "month",
                      e.target.value === "all" ? "all" : Number(e.target.value),
                    )
                  }
                  className="filter-select"
                >
                  <option value="all">すべての月</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </FilterField>

              {/* 種目 */}
              <FilterField icon={Users} iconClass="text-emerald-600" label="種目・部門">
                <select
                  value={filters.category}
                  onChange={(e) =>
                    update("category", e.target.value as FilterState["category"])
                  }
                  className="filter-select"
                >
                  <option value="all">すべての種目</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </FilterField>

              {/* 階級 */}
              <FilterField icon={Trophy} iconClass="text-amber-500" label="対象階級">
                <select
                  value={filters.tier}
                  onChange={(e) =>
                    update("tier", e.target.value as FilterState["tier"])
                  }
                  className="filter-select"
                >
                  <option value="all">すべての階級</option>
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </FilterField>

              {/* 受付状況 */}
              <FilterField
                icon={Bookmark}
                iconClass="text-emerald-600"
                label="受付状況"
              >
                <select
                  value={filters.status}
                  onChange={(e) =>
                    update("status", e.target.value as StatusFilter)
                  }
                  className="filter-select"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              {/* 検索 */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>大会名・会場検索</span>
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(e) => update("keyword", e.target.value)}
                    placeholder="有明、秋季、ダブルス..."
                    className="w-full text-sm bg-white border border-slate-200 rounded-xl pl-8 pr-8 min-h-[44px] text-slate-800 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  {filters.keyword && (
                    <button
                      type="button"
                      onClick={() => update("keyword", "")}
                      aria-label="検索をクリア"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconClass,
  label,
  value,
  valueClass,
}: {
  icon: typeof Calendar;
  iconClass: string;
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm flex items-center gap-3">
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          iconClass,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-slate-500">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-lg sm:text-xl font-bold tabular-nums", valueClass)}>
            {value}
          </span>
          <span className="text-xs text-slate-400 font-bold">大会</span>
        </div>
      </div>
    </div>
  );
}

function SortBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ArrowUp;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2.5 min-h-[40px] rounded-lg transition",
        active ? "bg-slate-100 text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

function FilterField({
  icon: Icon,
  iconClass,
  label,
  children,
}: {
  icon: typeof Calendar;
  iconClass: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
        <Icon className={cn("w-3 h-3", iconClass)} />
        <span>{label}</span>
      </label>
      {children}
    </div>
  );
}
