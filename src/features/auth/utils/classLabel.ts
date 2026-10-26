// GRANレベル数値 → 規定階級ラベル（8段階）への変換。
// db-schema.md / requirements-detail-user.md 1.1 の査定基準レンジ（8段階）に準拠。
//   A級:850〜999 / AB級:750〜849 / B級:650〜749 / BC級:550〜649 /
//   C級:450〜549 / CD級:350〜449 / D級:250〜349 / DE級:100〜249
//
// ※仕様書のレンジは一部オーバーラップ表記があるため、
//   連続した境界値（下限値）で一意に判定できるよう整理している。

import type { TournamentTier } from "@/features/tournaments/types/tournament";

// GRANレベル → 8段階の階級コード（ENUM 値）。
export function granLevelToTier(granLevel: number): TournamentTier {
  if (granLevel >= 850) return "A";
  if (granLevel >= 750) return "AB";
  if (granLevel >= 650) return "B";
  if (granLevel >= 550) return "BC";
  if (granLevel >= 450) return "C";
  if (granLevel >= 350) return "CD";
  if (granLevel >= 250) return "D";
  return "DE";
}

// GRANレベル → 階級ラベル（例: "B級"）。
export function granLevelToClassLabel(granLevel: number): string {
  return `${granLevelToTier(granLevel)}級`;
}
