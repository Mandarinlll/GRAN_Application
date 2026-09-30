// GRANレベル数値 → 規定階級ラベル（A〜E級）への変換。
// requirements-detail-user.md 1.1 の査定基準に準拠。
//   A級: 790〜999 / B級: 590〜789 / C級: 390〜589 / D級: 190〜389 / E級・未出場: 189以下

export function granLevelToClassLabel(granLevel: number): string {
  if (granLevel >= 790) return "A級";
  if (granLevel >= 590) return "B級";
  if (granLevel >= 390) return "C級";
  if (granLevel >= 190) return "D級";
  return "E級";
}
