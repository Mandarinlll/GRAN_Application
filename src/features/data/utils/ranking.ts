// ランキング整列・順位付与の純粋関数（データタブ GRAN_Data_Tab）。
//
// 設計 Decision（論点B / 同率時順序）に従い、以下の安定順序で整列する:
//   gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC
//
// 順位（rank）は 1 始まりで付与し、同率（gran_level が同一）の要素には
// 同一順位を付与する（standard competition ranking）。タイブレーク項目
// （rated_match_count / login_id / created_at）は表示順序のみを決定し、
// gran_level が等しい限り rank は同一となる。
//
// 本関数は純粋関数として公開し、currentUser.ts の rankInClass からも
// 再利用できるようにする（Future Integration Points）。
//
// _Requirements: 2.1, 2.9, 3.2, 3.6_ / _Properties: 1_

import {
  granLevelToTier,
  granLevelToClassLabel,
} from "@/features/auth/utils/classLabel";
import type { RankableUser, RankedUser } from "@/features/data/types/data";

// 安定順序の比較関数:
//   1) gran_level 降順
//   2) rated_match_count 降順
//   3) login_id 昇順
//   4) created_at 昇順
function compareRankable(a: RankableUser, b: RankableUser): number {
  if (a.granLevel !== b.granLevel) {
    return b.granLevel - a.granLevel; // DESC
  }
  if (a.ratedMatchCount !== b.ratedMatchCount) {
    return b.ratedMatchCount - a.ratedMatchCount; // DESC
  }
  if (a.loginId !== b.loginId) {
    return a.loginId < b.loginId ? -1 : 1; // ASC
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1; // ASC
  }
  return 0;
}

/**
 * ユーザー集合を安定順序で整列し、1 始まりの順位（同率は同順位）を付与する。
 *
 * - 整列順: gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC
 * - 順位: gran_level が同一の要素には同一の rank を付与（standard competition ranking）。
 *   gran_level が異なる要素が現れた時点で、rank をそれまでに出現した件数（0 始まり）+ 1 に更新する。
 * - tier / classLabel は granLevelToTier / granLevelToClassLabel に準拠して付与する。
 *
 * 入力配列は変更せず、新しい配列を返す。
 */
export function rankUsers(users: RankableUser[]): RankedUser[] {
  const sorted = [...users].sort(compareRankable);

  const result: RankedUser[] = [];
  let currentRank = 0;
  let prevGranLevel: number | null = null;

  for (let i = 0; i < sorted.length; i += 1) {
    const user = sorted[i];

    // gran_level が直前と異なる場合は、これまでの出現件数 +1 を新しい順位とする。
    // 同一の場合は直前の順位を据え置く（同率同順位）。
    if (prevGranLevel === null || user.granLevel !== prevGranLevel) {
      currentRank = i + 1;
      prevGranLevel = user.granLevel;
    }

    result.push({
      ...user,
      rank: currentRank,
      tier: granLevelToTier(user.granLevel),
      classLabel: granLevelToClassLabel(user.granLevel),
    });
  }

  return result;
}
