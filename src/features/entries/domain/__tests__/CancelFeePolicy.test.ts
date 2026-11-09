// CancelFeePolicy の境界検証（oop-architecture.md §5 / §11）。
// 日数差は Math.round（当日0起点）、境界 8日→0% / 3日→50%（Math.floor）/ 2日以下→100% を保存する。

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { CancelFeePolicy } from "@/features/entries/domain/CancelFeePolicy";

// 基準日（申請日）。固定の現在時刻として扱う。
const BASE = new Date(2024, 5, 1, 12, 0, 0); // 2024-06-01 12:00（ローカル）

// BASE から n 日後の開催日 "YYYY-MM-DD" を返す。
function eventDatePlusDays(n: number): string {
  const d = new Date(2024, 5, 1 + n, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("CancelFeePolicy.calculate", () => {
  const policy = new CancelFeePolicy();

  it("開催8日前は無料（0%）", () => {
    const fee = policy.calculate(eventDatePlusDays(8), 5000, BASE);
    expect(fee.daysBefore).toBe(8);
    expect(fee.feeRate).toBe(0);
    expect(fee.feeAmount).toBe(0);
    expect(fee.isPaid).toBe(false);
    expect(fee.adminStatus).toBe("NOT_REQUIRED");
  });

  it("開催7日前は50%（Math.floor(fee*0.5)）", () => {
    const fee = policy.calculate(eventDatePlusDays(7), 5001, BASE);
    expect(fee.daysBefore).toBe(7);
    expect(fee.feeRate).toBe(50);
    expect(fee.feeAmount).toBe(Math.floor(5001 * 0.5)); // 2500
    expect(fee.isPaid).toBe(true);
    expect(fee.adminStatus).toBe("UNCONTACTED");
  });

  it("開催3日前は50%（下限境界）", () => {
    const fee = policy.calculate(eventDatePlusDays(3), 4000, BASE);
    expect(fee.daysBefore).toBe(3);
    expect(fee.feeRate).toBe(50);
    expect(fee.feeAmount).toBe(2000);
  });

  it("開催2日前は100%", () => {
    const fee = policy.calculate(eventDatePlusDays(2), 4000, BASE);
    expect(fee.daysBefore).toBe(2);
    expect(fee.feeRate).toBe(100);
    expect(fee.feeAmount).toBe(4000);
    expect(fee.isPaid).toBe(true);
    expect(fee.adminStatus).toBe("UNCONTACTED");
  });

  it("過去日（当日より前）も100%", () => {
    const fee = policy.calculate(eventDatePlusDays(-1), 3000, BASE);
    expect(fee.daysBefore).toBe(-1);
    expect(fee.feeRate).toBe(100);
    expect(fee.feeAmount).toBe(3000);
  });

  it("日数差は Math.round（当日0起点）で、料率は daysBefore のみで決まる", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 60 }),
        fc.integer({ min: 0, max: 100000 }),
        (days, entryFee) => {
          const fee = policy.calculate(eventDatePlusDays(days), entryFee, BASE);
          expect(fee.daysBefore).toBe(days);
          if (days >= 8) {
            expect(fee.feeRate).toBe(0);
            expect(fee.feeAmount).toBe(0);
          } else if (days >= 3) {
            expect(fee.feeRate).toBe(50);
            expect(fee.feeAmount).toBe(Math.floor(entryFee * 0.5));
          } else {
            expect(fee.feeRate).toBe(100);
            expect(fee.feeAmount).toBe(entryFee);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
