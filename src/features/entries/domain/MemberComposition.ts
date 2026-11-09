// メンバー構成の妥当性（人数レンジ）を検証する VO（oop-architecture.md §2.2 / §5）。
//
// 現行 tournaments/utils/category.ts の memberCountRange を CategoryRules を内部利用して吸収。
//   SINGLES = 1〜1 / DOUBLES = 2〜2 / 団体戦 = teamSizeMin??4〜teamSizeMax??6
// の既定を保存する。DB・Zod・Next.js に依存しない純粋な TypeScript とする。

import type { TournamentCategory } from "@/features/tournaments/types/tournament";

export interface MemberCountRange {
  min: number;
  max: number;
}

export class MemberComposition {
  // 種目ごとに必要なメンバー人数（最小・最大）を返す。
  // 団体戦は大会側の team_size_min/max を優先し、無指定時はこの既定を使う。
  static countRange(
    category: TournamentCategory,
    teamSizeMin: number | null,
    teamSizeMax: number | null,
  ): MemberCountRange {
    if (category === "SINGLES") return { min: 1, max: 1 };
    if (category === "DOUBLES") return { min: 2, max: 2 };
    // 団体戦: 大会指定があればそれを使う。無指定なら 4〜6 名（仕様の既定）。
    return {
      min: teamSizeMin ?? 4,
      max: teamSizeMax ?? 6,
    };
  }

  // 指定人数が種目の人数レンジに収まるか。
  static isValidCount(
    count: number,
    category: TournamentCategory,
    teamSizeMin: number | null,
    teamSizeMax: number | null,
  ): boolean {
    const range = MemberComposition.countRange(
      category,
      teamSizeMin,
      teamSizeMax,
    );
    return count >= range.min && count <= range.max;
  }
}
