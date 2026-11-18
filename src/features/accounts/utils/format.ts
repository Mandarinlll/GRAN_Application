export const UNSET_LABEL = "未設定";

/** null / undefined / 空白のみの文字列は「未設定」。数値 0 と false は値として表示する。 */
export function displayOrUnset(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return UNSET_LABEL;
  if (typeof value === "string") return value.trim() === "" ? UNSET_LABEL : value;
  return String(value);
}

/** 例: 「51–100 件目」。total が 0 のときは「0 件」。 */
export function formatDisplayRange(from: number, to: number): string {
  if (to < from || to <= 0) return "0 件";
  return `${from}–${to} 件目`;
}
