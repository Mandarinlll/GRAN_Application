// レベル推移・出場履歴の期間フィルタ境界算出（純粋関数）。
//
// 期間フィルタ種別（全期間 / 直近1年 / 6ヶ月 / 3ヶ月）に対し、
// 下限となる `recorded_at`（JST 文字列）を算出する。全期間は `null`。
//
// 日時は既存規約（`NOW_JST` = SQLite `datetime('now', '+9 hours')`）に合わせ、
// `YYYY-MM-DD HH:MM:SS` 形式の JST 文字列として扱う。この形式は辞書順と
// 時系列順が一致するため、戻り値をそのまま `recorded_at >= lowerBound`
// の比較に用いることができる。
//
// _Requirements: 5.4, 5.5 / Properties: 7_

import type { PeriodFilter } from "@/features/data/types/data";

export type { PeriodFilter };

// 既存の JST 文字列（例: "2026-01-31 12:34:56"）を Date に変換する。
// userRepository.isLocked と同様、スペースを "T" に置換してパースする。
// SQLite の datetime() はローカルタイムゾーン情報を持たない素の値のため、
// ここでも素の（ローカル解釈の）Date として扱い、算出後に同形式へ戻す。
function parseJst(now: string): Date {
  const normalized = now.trim().replace(" ", "T");
  return new Date(normalized);
}

// Date を `YYYY-MM-DD HH:MM:SS`（JST 文字列）へ整形する。
function formatJst(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

// 期間種別に応じて下限 recorded_at（JST 文字列）を返す。
// - "ALL" : 下限なし（全期間）→ null
// - "1Y"  : now の 1 年前
// - "6M"  : now の 6 ヶ月前
// - "3M"  : now の 3 ヶ月前
export function periodLowerBound(
  period: PeriodFilter,
  now: string,
): string | null {
  if (period === "ALL") {
    return null;
  }

  const base = parseJst(now);
  const lower = new Date(base.getTime());

  switch (period) {
    case "1Y":
      lower.setFullYear(lower.getFullYear() - 1);
      break;
    case "6M":
      lower.setMonth(lower.getMonth() - 6);
      break;
    case "3M":
      lower.setMonth(lower.getMonth() - 3);
      break;
  }

  return formatJst(lower);
}
