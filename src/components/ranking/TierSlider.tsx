"use client";

import { useId } from "react";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import {
  SLIDER_MAX,
  SLIDER_MIN,
  TIER_ORDER,
  sliderValueToTier,
  tierToSliderValue,
} from "@/features/data/utils/tier";

interface TierSliderProps {
  tier: TournamentTier;
  onChange: (tier: TournamentTier) => void;
}

/**
 * 階級選択スライダー（左端 DE … 右端 A）。
 * ネイティブ range（step=1）に任せ、独自のキーハンドラは持たない。
 * 該当者0人・取得失敗のときも disabled にしない。
 */
export function TierSlider({ tier, onChange }: TierSliderProps) {
  const id = useId();

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-bold text-slate-900 dark:text-slate-100"
        >
          階級
        </label>
        <span
          aria-live="polite"
          className="text-sm font-bold text-emerald-700 dark:text-emerald-400"
        >
          選択中: {tier}級
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        value={tierToSliderValue(tier)}
        onChange={(e) => onChange(sliderValueToTier(Number(e.target.value)))}
        aria-valuetext={`${tier}級`}
        className="block min-h-[44px] w-full cursor-pointer accent-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:accent-emerald-500 dark:focus-visible:ring-emerald-500"
      />
      <div aria-hidden="true" className="flex justify-between px-1 text-xs">
        {TIER_ORDER.map((t) => (
          <span
            key={t}
            className={
              t === tier
                ? "font-bold text-emerald-700 dark:text-emerald-400"
                : "text-slate-600 dark:text-slate-400"
            }
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
