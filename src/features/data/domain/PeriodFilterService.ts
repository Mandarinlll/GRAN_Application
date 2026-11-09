// レベル推移・出場履歴の期間フィルタ境界算出のドメインサービス（oop-architecture.md §2.3 / §5）。
//
// 現行 data/utils/period.ts の periodLowerBound を 1:1 で移植した。
// 期間フィルタ種別（全期間 / 直近1年 / 6ヶ月 / 3ヶ月）に対し、下限となる recorded_at
// （JST 文字列 `YYYY-MM-DD HH:MM:SS`）を算出する。全期間は null。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { PeriodFilter } from "@/features/data/types/data";

// 既存の JST 文字列（例: "2026-01-31 12:34:56"）を Date に変換する。
// スペースを "T" に置換してパースする（SQLite datetime() は素の値のため素の Date として扱う）。
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

export class PeriodFilterService {
  // 期間種別に応じて下限 recorded_at（JST 文字列）を返す。全期間は null。
  periodLowerBound(period: PeriodFilter, now: string): string | null {
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
}
