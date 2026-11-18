// 一括登録の展開と重複検出（純粋関数）。

import type { TournamentInput } from "../types/adminTournament";
import type { TournamentCategory } from "../types/tournament";

export const BULK_MIN_ROWS = 1;
export const BULK_MAX_ROWS = 50;

// 共通項目。大会名は行ごとに上書きできる（未指定なら共通の大会名）。
export type BulkCommon = Omit<TournamentInput, "eventDate" | "category">;

export interface BulkRow {
  eventDate: string;
  category: TournamentCategory;
  title?: string | null;
}

function resolveTitle(common: BulkCommon, row: BulkRow): string {
  const t = row.title?.trim();
  return t ? t : common.title;
}

// 各行を TournamentInput に展開する。
export function expandBulk(common: BulkCommon, rows: BulkRow[]): TournamentInput[] {
  return rows.map((row) => ({
    ...common,
    title: resolveTitle(common, row),
    eventDate: row.eventDate,
    category: row.category,
  }));
}

// (開催日, 種目区分, 大会名) が既出の行と重複する行の 1 始まりの行番号を昇順で返す。
// 2 件目以降だけでなく、重複グループに属するすべての行を返す。
export function findDuplicateRows(
  rows: Array<{ eventDate: string; category: string; title: string }>,
): number[] {
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const key = JSON.stringify([r.eventDate, r.category, r.title]);
    const list = groups.get(key);
    if (list) list.push(i + 1);
    else groups.set(key, [i + 1]);
  });
  const result: number[] = [];
  for (const list of groups.values()) {
    if (list.length >= 2) result.push(...list);
  }
  return result.sort((a, b) => a - b);
}
