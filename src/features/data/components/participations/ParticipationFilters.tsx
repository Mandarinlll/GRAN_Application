"use client";

import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type { GenderDivision } from "../../types/dto";

export interface ParticipationFilterState {
  division?: GenderDivision;
  tier?: TournamentTier;
  year?: number;
  order: "asc" | "desc";
}

export const TIER_OPTIONS: readonly TournamentTier[] = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];

export const DIVISION_LABEL: Record<GenderDivision, string> = {
  MEN: "男子",
  WOMEN: "女子",
  MIXED: "混合",
};

const selectClass =
  "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-emerald-500";

export function ParticipationFilters({
  value,
  years,
  onChange,
}: {
  value: ParticipationFilterState;
  years: number[];
  onChange: (next: ParticipationFilterState) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="block text-sm text-slate-900 dark:text-slate-100">
        <span className="mb-1 block text-xs text-slate-700 dark:text-slate-300">種目</span>
        <select
          className={selectClass}
          value={value.division ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              division: (e.target.value || undefined) as ParticipationFilterState["division"],
            })
          }
        >
          <option value="">すべて</option>
          {(Object.keys(DIVISION_LABEL) as GenderDivision[]).map((d) => (
            <option key={d} value={d}>
              {DIVISION_LABEL[d]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-900 dark:text-slate-100">
        <span className="mb-1 block text-xs text-slate-700 dark:text-slate-300">階級</span>
        <select
          className={selectClass}
          value={value.tier ?? ""}
          onChange={(e) =>
            onChange({ ...value, tier: (e.target.value || undefined) as TournamentTier | undefined })
          }
        >
          <option value="">すべて</option>
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}級
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-900 dark:text-slate-100">
        <span className="mb-1 block text-xs text-slate-700 dark:text-slate-300">年</span>
        <select
          className={selectClass}
          value={value.year ?? ""}
          onChange={(e) =>
            onChange({ ...value, year: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">すべて</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-900 dark:text-slate-100">
        <span className="mb-1 block text-xs text-slate-700 dark:text-slate-300">開催日の並び順</span>
        <select
          className={selectClass}
          value={value.order}
          onChange={(e) => onChange({ ...value, order: e.target.value as "asc" | "desc" })}
        >
          <option value="desc">新しい順</option>
          <option value="asc">古い順</option>
        </select>
      </label>
    </div>
  );
}
