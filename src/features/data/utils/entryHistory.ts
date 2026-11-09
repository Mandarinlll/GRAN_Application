// 出場履歴のソート・フィルタの薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.3 / §5）に伴い、ロジックは data/domain/EntryHistoryService へ
// 移設した。本モジュールは残置する呼び出し元（EntryHistoryPanel.tsx が sortEntries/filterEntries と
// EntrySortKey/SortDirection 型を参照）を壊さないための薄い委譲ラッパである。

import {
  EntryHistoryService,
  type EntryFilter,
  type EntrySortKey,
  type SortDirection,
} from "@/features/data/domain/EntryHistoryService";
import type { EntryHistoryRow } from "@/features/data/types/data";

export type { EntrySortKey, SortDirection, EntryFilter };

const service = new EntryHistoryService();

export function sortEntries(
  rows: EntryHistoryRow[],
  key: EntrySortKey,
  direction: SortDirection,
): EntryHistoryRow[] {
  return service.sortEntries(rows, key, direction);
}

export function filterEntries(
  rows: EntryHistoryRow[],
  filter: EntryFilter = {},
): EntryHistoryRow[] {
  return service.filterEntries(rows, filter);
}
