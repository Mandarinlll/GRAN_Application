// チーム平均レート算出のドメインサービス（oop-architecture.md §2.3 / §5）。
//
// 現行 data/utils/teamRating.ts の computeTeamRating を 1:1 で移植した。
// メンバーの gran_level 配列から、有効レベル（100〜999）メンバーの算術平均を
// Math.round した整数を返す。有効メンバーが 0 名なら null（= ランキング対象外）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

const MIN_GRAN_LEVEL = 100;
const MAX_GRAN_LEVEL = 999;

function isValidGranLevel(level: number): boolean {
  return (
    Number.isFinite(level) &&
    level >= MIN_GRAN_LEVEL &&
    level <= MAX_GRAN_LEVEL
  );
}

export class TeamRatingService {
  // 有効 gran_level メンバーの平均レートを整数丸め。有効メンバー0なら null。
  computeTeamRating(memberLevels: number[]): number | null {
    const validLevels = memberLevels.filter(isValidGranLevel);

    if (validLevels.length === 0) {
      return null;
    }

    const sum = validLevels.reduce((acc, level) => acc + level, 0);
    return Math.round(sum / validLevels.length);
  }
}
