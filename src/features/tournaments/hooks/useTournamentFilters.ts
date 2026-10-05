// 大会一覧のフィルター・ソート状態を管理するカスタムフック。
// requirements-detail-user.md 2.1 のフィルター仕様に準拠：
//  - 初期ソート: 開催日の昇順（近い順）
//  - 終了済はデフォルト非表示（トグルで表示）
//  - 月 / 種目 / 階級 / 受付状況 / キーワードで絞り込み

import { useMemo, useState } from "react";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

export type StatusFilter = "all" | "OPEN" | "FEW" | "WAITLIST" | "ENTERED";
export type SortOrder = "asc" | "desc";

export interface FilterState {
  month: "all" | number;
  category: "all" | TournamentCategory;
  tier: "all" | TournamentTier;
  status: StatusFilter;
  keyword: string;
  includeFinished: boolean;
  sortOrder: SortOrder;
}

const INITIAL: FilterState = {
  month: "all",
  category: "all",
  tier: "all",
  status: "all",
  keyword: "",
  includeFinished: false,
  sortOrder: "asc",
};

export function useTournamentFilters(all: TournamentCardData[]) {
  const [filters, setFilters] = useState<FilterState>(INITIAL);

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setFilters(INITIAL);
  }

  const filtered = useMemo(() => {
    const kw = filters.keyword.trim().toLowerCase();

    const result = all.filter((t) => {
      // 終了済フィルター。
      if (!filters.includeFinished && (t.isPast || t.status === "FINISHED")) {
        return false;
      }
      // 月。
      if (filters.month !== "all" && t.month !== filters.month) return false;
      // 種目。
      if (filters.category !== "all" && t.category !== filters.category) {
        return false;
      }
      // 階級。
      if (filters.tier !== "all" && t.tier !== filters.tier) return false;
      // 受付状況。
      if (filters.status === "OPEN" && !(t.capacityStatus === "OPEN" || t.capacityStatus === "FEW")) {
        return false;
      }
      if (filters.status === "FEW" && t.capacityStatus !== "FEW") return false;
      if (filters.status === "WAITLIST" && t.capacityStatus !== "FULL") {
        return false;
      }
      if (filters.status === "ENTERED" && !t.isEntered) return false;
      // キーワード（大会名・会場）。
      if (kw) {
        const hay = `${t.title} ${t.venue}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    // ソート（開催日）。
    result.sort((a, b) => {
      const cmp = a.eventDate.localeCompare(b.eventDate);
      return filters.sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [all, filters]);

  // KPI 用の集計（全データ基準。終了済を除いた受付関連の件数）。
  const kpi = useMemo(() => {
    const upcoming = all.filter((t) => !t.isPast && t.status !== "FINISHED");
    return {
      total: all.length,
      open: upcoming.filter(
        (t) => t.status === "OPEN" && (t.capacityStatus === "OPEN" || t.capacityStatus === "FEW"),
      ).length,
      few: upcoming.filter((t) => t.capacityStatus === "FEW").length,
      entered: all.filter((t) => t.isEntered).length,
    };
  }, [all]);

  return { filters, update, reset, filtered, kpi };
}
