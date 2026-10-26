// キャンセル料率・請求額の判定（コーディング規約 5.1 / requirements-detail-user.md 3.4 準拠）。
//
// 日数計算の基準時刻：開催日当日の 00:00 を起点とした日数差。
//   - 開催8日前まで   : 無料（0%）
//   - 開催7日前〜3日前 : 50%
//   - 開催2日前〜当日  : 100%

import type { CancellationAdminStatus } from "@/features/entries/types/entry";

export interface CancelFeeResult {
  daysBefore: number; // 開催日までの残日数（当日0起点）
  feeRate: 0 | 50 | 100;
  feeAmount: number; // 請求額（円）
  isPaid: boolean; // 有償か
  adminStatus: CancellationAdminStatus; // 管理者対応初期ステータス
}

// 日付文字列（YYYY-MM-DD）を 00:00 の Date に正規化する。
function toDateOnly(dateStr: string): Date {
  // "YYYY-MM-DD" / "YYYY/MM/DD" 双方を許容する。
  const normalized = dateStr.replace(/\//g, "-");
  const [y, m, d] = normalized.split("-").map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

// 開催日とキャンセル申請日からキャンセル料を判定する。
// cancelDate を省略した場合は現在時刻を用いる。
export function calculateCancelFee(
  eventDate: string,
  entryFee: number,
  cancelDate: Date = new Date(),
): CancelFeeResult {
  const event = toDateOnly(eventDate);
  const today = new Date(
    cancelDate.getFullYear(),
    cancelDate.getMonth(),
    cancelDate.getDate(),
    0,
    0,
    0,
    0,
  );

  const diffMs = event.getTime() - today.getTime();
  const daysBefore = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysBefore >= 8) {
    return {
      daysBefore,
      feeRate: 0,
      feeAmount: 0,
      isPaid: false,
      adminStatus: "NOT_REQUIRED",
    };
  }
  if (daysBefore >= 3) {
    return {
      daysBefore,
      feeRate: 50,
      feeAmount: Math.floor(entryFee * 0.5),
      isPaid: true,
      adminStatus: "UNCONTACTED",
    };
  }
  // 開催2日前〜当日（daysBefore <= 2、過去日含む）。
  return {
    daysBefore,
    feeRate: 100,
    feeAmount: entryFee,
    isPaid: true,
    adminStatus: "UNCONTACTED",
  };
}
