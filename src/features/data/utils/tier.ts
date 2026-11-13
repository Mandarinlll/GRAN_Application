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

// Tier_Slider 用。スライダー値は TIER_ORDER の添字（0=DE … 7=A）。
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 7;

export function tierToSliderValue(tier: TournamentTier): number {
  return TIER_ORDER.indexOf(tier);
}

// 最寄りの整数に丸めて 0..7 にクランプ。NaN は 7(A)。
export function snapSliderValue(raw: number): number {
  if (Number.isNaN(raw)) return SLIDER_MAX;
  return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.round(raw)));
}

export function sliderValueToTier(value: number): TournamentTier {
  return TIER_ORDER[snapSliderValue(value)];
}

export function stepSliderValue(value: number, delta: 1 | -1): number {
  return snapSliderValue(snapSliderValue(value) + delta);
}

// 現在Tierが判定不能(null)のときは A（要件8.14）。
export function initialSliderTier(current: TournamentTier | null): TournamentTier {
  return current ?? "A";
}
