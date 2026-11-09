// GRANレベルを表す値オブジェクト（oop-architecture.md §2.2 / §8-3）。
//
// 複数 feature（auth = 登録・現在ユーザー、data = ランキング/分布/サマリ）が共有するため、
// どの feature にも属さない共有ドメイン基盤 src/domain/ に直接置く（§8-3 決定事項）。
// これにより data → auth のクロス feature import を発生させない。
//
// 値そのものが等価性を決める不変（immutable）オブジェクト。100〜999 の整数レートを表し、
// 範囲外・非整数はコンストラクタで拒否する（丸め責務は生成側の Domain Service に置く）。
// 現行 auth/utils/classLabel.ts の granLevelToTier / granLevelToClassLabel を toTier() /
// toClassLabel() として吸収する（下限値による連続境界判定・1:1 保存）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { TournamentTier } from "@/features/tournaments/types/tournament";

export class GranLevel {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value < 100 || value > 999) {
      throw new RangeError(
        `GranLevel は 100〜999 の整数で指定してください（received: ${value}）。`,
      );
    }
    this.value = value;
  }

  // GRANレベル → 8段階の階級コード（ENUM 値）。
  // db-schema.md / requirements-detail-user.md 1.1 の査定基準レンジ（下限値判定）に準拠。
  //   A級:850〜999 / AB級:750〜849 / B級:650〜749 / BC級:550〜649 /
  //   C級:450〜549 / CD級:350〜449 / D級:250〜349 / DE級:100〜249
  toTier(): TournamentTier {
    const granLevel = this.value;
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
  toClassLabel(): string {
    return `${this.toTier()}級`;
  }

  equals(other: GranLevel): boolean {
    return this.value === other.value;
  }
}
