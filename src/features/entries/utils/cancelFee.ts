// キャンセル料率・請求額の判定（コーディング規約 5.1 / requirements-detail-user.md 3.4 準拠）。
//
// OOP 化（oop-architecture.md §5）に伴い、算出ロジックは entries/domain/CancelFeePolicy へ移設した。
// 本モジュールは、クライアントコンポーネント（CancelEntryModal など）の既存呼び出しを壊さないための
// 薄い委譲ラッパとして残置する。アルゴリズム（Math.round・当日0起点・境界）は CancelFeePolicy を正とする。

import { CancelFeePolicy } from "@/features/entries/domain/CancelFeePolicy";
import type { CancelFeeResult } from "@/features/entries/domain/CancelFeePolicy";

export type { CancelFeeResult };

// 開催日とキャンセル申請日からキャンセル料を判定する。
// cancelDate を省略した場合は現在時刻を用いる。
export function calculateCancelFee(
  eventDate: string,
  entryFee: number,
  cancelDate: Date = new Date(),
): CancelFeeResult {
  return new CancelFeePolicy().calculate(eventDate, entryFee, cancelDate);
}
