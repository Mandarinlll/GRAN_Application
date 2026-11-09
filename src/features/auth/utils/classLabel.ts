// GRANレベル数値 → 規定階級ラベル（8段階）への変換。
//
// OOP 化（oop-architecture.md §5 / §8-3）に伴い、判定ロジックは共有ドメイン基盤
// src/domain/GranLevel.ts（VO）へ移設した。本モジュールは data などの既存呼び出し元を
// 壊さないための薄い委譲ラッパとして残置する（data は FEAT-003 の data サブフェーズで
// GranLevel を直接参照へ移行し、data → auth のクロス feature import を解消する）。

import type { TournamentTier } from "@/features/tournaments/types/tournament";
import { GranLevel } from "@/domain/GranLevel";

// GRANレベル → 8段階の階級コード（ENUM 値）。
export function granLevelToTier(granLevel: number): TournamentTier {
  return new GranLevel(granLevel).toTier();
}

// GRANレベル → 階級ラベル（例: "B級"）。
export function granLevelToClassLabel(granLevel: number): string {
  return new GranLevel(granLevel).toClassLabel();
}
