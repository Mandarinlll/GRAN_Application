// キャンセル記録エンティティ（oop-architecture.md §2.1 / §6.2.2）。
//
// Entry.cancel が CancelFeePolicy.calculate の算出値から生成する書き込み系エンティティ。
// cancellations テーブルへの挿入に必要なフィールドを保持する（id / 日時は Repository が採番）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする。

import type { CancellationAdminStatus } from "@/features/entries/types/entry";

export class Cancellation {
  constructor(
    readonly entryId: string,
    readonly daysBefore: number,
    readonly feeRate: 0 | 50 | 100,
    readonly feeAmount: number,
    readonly isPaid: boolean,
    readonly adminStatus: CancellationAdminStatus,
  ) {}
}
