// GRANレベル初期査定のドメインサービス（oop-architecture.md §2.3 / §5）。
//
// requirements-detail-user.md 1.1 の査定基準と register 画面の8段階レンジに準拠。
// 登録時点では管理者による正式査定前（is_level_calibrated = false）のため、
// ここで求める値はあくまで自己申告階級に基づく暫定初期値である。
//
// 重要（設計ロック）: 中央値算出レンジ（CLASS_RANGE、一部オーバーラップ表記）は、
// GranLevel.toTier() の判定境界（連続した下限値）とは別定義のまま保存する（統一禁止）。
// 丸め（Math.max/min/round）は本サービス側で行い、丸めた値で GranLevel を生成する。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { DeclaredClass } from "@/types/user";
import { GranLevel } from "@/domain/GranLevel";

// 各申告階級の暫定レンジ [min, max]（register 画面の案内レンジ準拠）。
// ここでは「暫定初期値の中央値算出」専用のレンジを用いる。
// 一方、確定後の数値 → 階級ラベル変換は GranLevel.toTier() の連続境界（下限値判定）を正とする
// （本レンジは一部オーバーラップ表記を含むため、階級判定には使用しないこと）。
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

export class GranLevelAssignmentService {
  // 申告階級から暫定初期GRANレベル（レンジ中央値）を算出し GranLevel を生成する。
  // 100〜999 に丸めてから生成するため、必ず有効範囲に収まる。
  estimateInitialGranLevel(declaredClass: DeclaredClass): GranLevel {
    const [min, max] = CLASS_RANGE[declaredClass];
    const mid = Math.round((min + max) / 2);
    const clamped = Math.max(100, Math.min(999, mid));
    return new GranLevel(clamped);
  }
}
