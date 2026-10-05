// 大会カード・一覧表・詳細で共通利用するバッジ類。
// デザインシステム（ui-design-system.md）のセマンティックトークンに準拠。

import { cn } from "@/lib/utils";
import type {
  CapacityStatus,
} from "@/features/tournaments/utils/capacity";
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  type TournamentCategory,
  type TournamentStatus,
  type TournamentTier,
} from "@/features/tournaments/types/tournament";

// 空き状況バッジ（受付中/残りわずか/満員）。
export function CapacityBadge({
  status,
  isEntered,
  className,
}: {
  status: CapacityStatus;
  isEntered?: boolean;
  className?: string;
}) {
  if (isEntered) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
          "bg-purple-50 text-purple-700 border-purple-200",
          className,
        )}
      >
        自チーム申込中
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
        status === "OPEN" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        status === "FEW" && "bg-amber-50 text-amber-700 border-amber-200",
        status === "FULL" && "bg-rose-50 text-rose-700 border-rose-200",
        className,
      )}
    >
      {status === "OPEN"
        ? "空き枠あり"
        : status === "FEW"
          ? "残りわずか"
          : "満員 (キャンセル待ち)"}
    </span>
  );
}

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
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
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
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
        "bg-slate-100 text-slate-700 border border-slate-200",
        className,
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

// 大会ステータスのうち、受付終了系（締切/終了/中止）を表すバッジ。
export function LifecycleBadge({
  status,
  className,
}: {
  status: TournamentStatus;
  className?: string;
}) {
  const label =
    status === "FINISHED"
      ? "終了"
      : status === "CLOSED"
        ? "締め切り"
        : status === "CANCELLED"
          ? "中止"
          : status === "UPCOMING"
            ? "受付前"
            : "";
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
        "bg-slate-200 text-slate-600",
        className,
      )}
    >
      {label}
    </span>
  );
}
