// GRANレベル初期査定の補助ロジック。
// requirements-detail-user.md 1.1 の査定基準と register 画面の8段階レンジに準拠。
//
// 登録時点では管理者による正式査定前（is_level_calibrated = false）のため、
// ここで求める値はあくまで自己申告階級に基づく暫定初期値である。

import type { DeclaredClass } from "@/types/user";

// 各申告階級の暫定レンジ [min, max]（register.html の classGuidanceMap 準拠）。
const CLASS_RANGE: Record<DeclaredClass, readonly [number, number]> = {
  A: [850, 999],
  AB: [750, 870],
  B: [650, 770],
  BC: [550, 670],
  C: [450, 570],
  CD: [350, 470],
  D: [250, 370],
  DE: [100, 270],
};

// 申告階級から暫定初期GRANレベル（レンジ中央値）を算出する。
// 100〜999 に丸めて返す。
export function estimateInitialGranLevel(declaredClass: DeclaredClass): number {
  const [min, max] = CLASS_RANGE[declaredClass];
  const mid = Math.round((min + max) / 2);
  return Math.max(100, Math.min(999, mid));
}
