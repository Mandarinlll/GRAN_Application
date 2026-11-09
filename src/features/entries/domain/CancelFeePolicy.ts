// キャンセル料率・請求額を決める方策 VO（oop-architecture.md §2.2 / §5 / §6.2.2）。
//
// 現行 entries/utils/cancelFee.ts の calculateCancelFee ロジックを 1:1 で移設したもの。
// 日数差は Math.round(diffMs / 86400000)（当日 0 起点）を厳密に保存する
// （既存規約 §5.1 サンプルの Math.ceil は採用しない。ビヘイビア保存のため実装を正とする）。
//   - 開催8日前まで   : 無料（0%）
//   - 開催7日前〜3日前 : 50%（Math.floor(fee * 0.5)）
//   - 開催2日前〜当日  : 100%
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

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

export class CancelFeePolicy {
  // 開催日とキャンセル申請日からキャンセル料を判定する。
  // when を省略した場合は現在時刻を用いる。
  calculate(
    eventDate: string,
    entryFee: number,
    when: Date = new Date(),
  ): CancelFeeResult {
    const event = toDateOnly(eventDate);
    const today = new Date(
      when.getFullYear(),
      when.getMonth(),
      when.getDate(),
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
}
