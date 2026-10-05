// 大会カード・一覧表・詳細で共通利用するバッジ類。
// デザインシステム（ui-design-system.md）のセマンティックトークンに準拠。

import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  type TournamentCategory,
  type TournamentTier,
} from "@/features/tournaments/types/tournament";

// 種目区分バッジ。
export function CategoryBadge({
  category,
  className,
}: {
  category: TournamentCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold",
        "bg-indigo-50 text-indigo-700 border border-indigo-200",
        className,
      )}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

// 階級バッジ。
export function TierBadge({
  tier,
  className,
}: {
  tier: TournamentTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold",
        "bg-slate-100 text-slate-700 border border-slate-200",
        className,
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}


