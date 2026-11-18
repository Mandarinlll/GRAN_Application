// 警告判定・定員比率・参加費合計・確認要否（純粋関数）。
// 日時は JST 文字列（YYYY-MM-DD HH:mm:ss）で、辞書順比較が時刻順と一致する。

import type { TournamentStatus } from "../types/tournament";

// 定員に対する確定数の表示。percent = floor(confirmed*100/capacity) を 0〜100 に収める。
export function formatCapacityRatio(
  confirmed: number,
  capacity: number,
): { label: string; percent: number } {
  const raw = capacity > 0 ? Math.floor((confirmed * 100) / capacity) : 0;
  const percent = Math.min(100, Math.max(0, raw));
  return { label: `${confirmed} / ${capacity}`, percent };
}

// 参加費合計 = 参加費 × 確定エントリー数。
export function totalEntryFee(entryFee: number, confirmed: number): number {
  return entryFee * confirmed;
}

// DRAFT かつ現在日時 >= 受付開始日時。
export function isDraftOverdue(
  t: { status: TournamentStatus; entryStartAt: string },
  nowJst: string,
): boolean {
  return t.status === "DRAFT" && nowJst >= t.entryStartAt;
}

function daysInMonth(year: number, month: number): number {
  // month は 1〜12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 開催日の 1 か月前の同日（YYYY-MM-DD）。存在しない日は前月末日へ丸める。
export function oneMonthBefore(eventDate: string): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  let year = y;
  let month = m - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  const day = Math.min(d, daysInMonth(year, month));
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

// 現在日時 >= 開催日の 1 か月前の同日 00:00:00、かつ閾値が設定され、かつ確定数 < 閾値。
export function isUnderCapacityAlert(
  t: { eventDate: string; alertThreshold: number | null },
  confirmed: number,
  nowJst: string,
): boolean {
  if (t.alertThreshold === null) return false;
  if (nowJst < `${oneMonthBefore(t.eventDate)} 00:00:00`) return false;
  return confirmed < t.alertThreshold;
}

// 参加費が変わり、かつ確定エントリーが 1 件以上あるとき確認が必要。
export function needsFeeConfirmation(
  oldFee: number,
  newFee: number,
  confirmed: number,
): boolean {
  return oldFee !== newFee && confirmed >= 1;
}
