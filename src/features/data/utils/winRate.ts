// 勝率(%)。total=0 は null。整数演算で丸め、浮動小数の誤差を避ける（四捨五入）。
export function winRatePercent1(wins: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((wins * 1000) / total) / 10;
}

export function winRatePercentInt(wins: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((wins * 100) / total);
}

export function formatRate1(r: number | null): string {
  return r === null ? "-" : `${r.toFixed(1)}%`;
}
