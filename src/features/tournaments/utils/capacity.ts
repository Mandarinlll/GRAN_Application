// 大会の空き枠ステータス算出（requirements-detail-user.md 2.1 準拠）。
//   - 残枠ゼロ            : FULL（満員 / キャンセル待ち）
//   - 充足率 75% 以上      : FEW（残りわずか・黄色バッジ）
//   - それ以外            : OPEN（空き枠あり）

export type CapacityStatus = "OPEN" | "FEW" | "FULL";

// 残り枠数を算出する（0未満は0に丸める）。
export function calcRemaining(capacity: number, confirmedCount: number): number {
  return Math.max(0, capacity - confirmedCount);
}

// 充足状況から派生ステータスを算出する。
// 「75%以上で残りわずか」= 確定数 / 定員 >= 0.75。
export function calcCapacityStatus(
  capacity: number,
  confirmedCount: number,
): CapacityStatus {
  if (capacity <= 0) return "FULL";
  const remaining = calcRemaining(capacity, confirmedCount);
  if (remaining <= 0) return "FULL";
  const ratio = confirmedCount / capacity;
  if (ratio >= 0.75) return "FEW";
  return "OPEN";
}
