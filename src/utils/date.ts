// 全体共通の日付フォーマットユーティリティ。
// 本アプリは日本国内専用のため、曜日・表記は日本語ロケール固定とする。

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

// "YYYY-MM-DD"（または "YYYY/MM/DD"）を Date（ローカル 00:00）へ。
function parseDateOnly(dateStr: string): Date {
  const normalized = dateStr.replace(/\//g, "-");
  const [y, m, d] = normalized.split("-").map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// "YYYY-MM-DD" → "2026/09/20 (日)" 形式。
export function formatEventDate(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const w = WEEKDAY_JP[date.getDay()];
  return `${y}/${m}/${d} (${w})`;
}

// "HH:MM" を安全にそのまま返す（秒やミリ秒が付いていれば切り落とす）。
export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

// 金額（円） → "¥20,000" 形式。
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

// 開催日が指定日（既定: 今日）より前か。
export function isPastDate(dateStr: string, base: Date = new Date()): boolean {
  const event = parseDateOnly(dateStr);
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return event.getTime() < today.getTime();
}

// 開催日の「月」(1-12) を返す。フィルター用。
export function monthOf(dateStr: string): number {
  return parseDateOnly(dateStr).getMonth() + 1;
}
