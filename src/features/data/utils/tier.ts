import { granLevelToTier } from "@/features/auth/utils/classLabel";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type { PromotionNextDto } from "../types/dto";

// 下位 → 上位
export const TIER_ORDER: readonly TournamentTier[] = [
  "DE",
  "D",
  "CD",
  "C",
  "BC",
  "B",
  "AB",
  "A",
];

const LOWER_BOUND: Record<TournamentTier, number> = {
  DE: 100,
  D: 250,
  CD: 350,
  C: 450,
  BC: 550,
  B: 650,
  AB: 750,
  A: 850,
};

const MAX_LEVEL = 999;

export function tierLowerBound(tier: TournamentTier): number {
  return LOWER_BOUND[tier];
}

// 次階級の下限 - 1。最上位は 999。
export function tierUpperBound(tier: TournamentTier): number {
  const next = nextTier(tier);
  return next ? LOWER_BOUND[next] - 1 : MAX_LEVEL;
}

export function nextTier(tier: TournamentTier): TournamentTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

export interface PromotionInfo {
  tier: TournamentTier;
  next: PromotionNextDto | null;
}

export function computePromotion(granLevel: number): PromotionInfo {
  const tier = granLevelToTier(granLevel);
  const nt = nextTier(tier);
  if (!nt) return { tier, next: null };

  const threshold = LOWER_BOUND[nt];
  const lower = LOWER_BOUND[tier];
  const raw = ((granLevel - lower) / (threshold - lower)) * 100;
  const progressPercent = Math.min(100, Math.max(0, raw));
  return {
    tier,
    next: {
      tier: nt,
      threshold,
      pointsToGo: threshold - granLevel,
      progressPercent,
    },
  };
}
