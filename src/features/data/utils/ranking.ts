import { granLevelToTier } from "@/features/auth/utils/classLabel";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type { RankingCategory, RankingRowDto } from "../types/dto";
import { tierLowerBound, tierUpperBound } from "./tier";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface RankCandidate {
  userId: string;
  granLevel: number;
  ratedMatchCount: number;
  recentWins: number;
  recentTotal: number;
  isLevelCalibrated: boolean;
}

/**
 * 直近勝率の降順比較（整数の交差乗算）。負 = a が上位。
 * recentTotal = 0 は最下位扱い（total > 0 のものより常に下）。
 */
function compareRecentRateDesc(
  a: { recentWins: number; recentTotal: number },
  b: { recentWins: number; recentTotal: number },
): number {
  if (a.recentTotal === 0 && b.recentTotal === 0) return 0;
  if (a.recentTotal === 0) return 1;
  if (b.recentTotal === 0) return -1;
  // a.wins/a.total vs b.wins/b.total
  const left = a.recentWins * b.recentTotal;
  const right = b.recentWins * a.recentTotal;
  return right - left;
}

/**
 * 階級内順位。未査定を除外 → 階級範囲に絞る →
 * (granLevel 降順, ratedMatchCount 降順, 直近勝率 降順, userId 昇順) で整列し、1..N の連番を付与する。
 */
export function rankWithinTier(
  cs: RankCandidate[],
  tier: TournamentTier,
): Array<RankCandidate & { rank: number }> {
  const lo = tierLowerBound(tier);
  const hi = tierUpperBound(tier);
  return cs
    .filter((c) => c.isLevelCalibrated && c.granLevel >= lo && c.granLevel <= hi)
    .sort((a, b) => {
      if (a.granLevel !== b.granLevel) return b.granLevel - a.granLevel;
      if (a.ratedMatchCount !== b.ratedMatchCount) {
        return b.ratedMatchCount - a.ratedMatchCount;
      }
      const r = compareRecentRateDesc(a, b);
      if (r !== 0) return r;
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    })
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * 競技順位（1,2,2,4）。rank = 1 + (自分より granLevel が厳密に高い人数)。
 * 入力順は保持せず granLevel 降順に整列して返す（同値の相対順は入力順を維持）。
 */
export function rankByCompetition<T extends { granLevel: number }>(
  rows: T[],
): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => b.granLevel - a.granLevel);
  const result: Array<T & { rank: number }> = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].granLevel !== sorted[i - 1].granLevel) rank = i + 1;
    result.push({ ...sorted[i], rank });
  }
  return result;
}

/** 種目別の母集団選択。MEN→MALE、WOMEN→FEMALE、MIXED→全員。 */
export function selectCategoryPool<T extends { gender: Gender | null }>(
  users: T[],
  category: RankingCategory,
): T[] {
  if (category === "MIXED") return [...users];
  const target: Gender = category === "MEN" ? "MALE" : "FEMALE";
  return users.filter((u) => u.gender === target);
}

/** クライアントへ渡すランキング行（userId を含まない） */
export type PublicRankingRowDto = Omit<RankingRowDto, "userId">;

/**
 * 公開4項目（順位・ニックネーム・アイコン・GRANレベル）+ tier + isMe のみを返す。
 * userId は isMe の算出にのみ使い、戻り値には含めない。
 */
export function toRankingRowDto(
  row: {
    rank: number;
    userId: string;
    nickname: string;
    avatarUrl: string | null;
    granLevel: number;
  },
  myUserId: string,
): PublicRankingRowDto {
  return {
    rank: row.rank,
    nickname: row.nickname,
    avatarUrl: row.avatarUrl,
    granLevel: row.granLevel,
    tier: granLevelToTier(row.granLevel),
    isMe: row.userId === myUserId,
  };
}
