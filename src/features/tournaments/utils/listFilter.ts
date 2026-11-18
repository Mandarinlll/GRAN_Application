// 大会一覧の並び順・絞り込み・期間検証（純粋関数）。

import type { TournamentStatus } from "../types/tournament";

// 開催日の降順、同日は大会名の昇順。元の配列は変更しない。
export function sortTournaments<T extends { eventDate: string; title: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? 1 : -1;
    if (a.title === b.title) return 0;
    return a.title < b.title ? -1 : 1;
  });
}

export interface TournamentFilter {
  status?: TournamentStatus;
  q?: string;
  from?: string; // YYYY-MM-DD（含む）
  to?: string; // YYYY-MM-DD（含む）
}

// 指定された条件すべてを満たす大会のみを返す（論理積）。
// 大会名は大文字小文字を区別しない部分一致。空文字の条件は未指定として扱う。
export function filterTournaments<
  T extends { status: TournamentStatus; title: string; eventDate: string },
>(rows: T[], f: TournamentFilter): T[] {
  const q = f.q ? f.q.toLowerCase() : "";
  return rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (q && !r.title.toLowerCase().includes(q)) return false;
    if (f.from && r.eventDate < f.from) return false;
    if (f.to && r.eventDate > f.to) return false;
    return true;
  });
}

// 開始日 > 終了日のときエラーメッセージを返す。それ以外は null。
export function validateDateRange(from?: string, to?: string): string | null {
  if (from && to && from > to) {
    return "開始日は終了日以前の日付を指定してください";
  }
  return null;
}
