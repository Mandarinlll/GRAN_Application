// 共通ステータスバッジ（ui-design-system.md §4.3 / 規約 §4.3 準拠）。
//
// 従来は各ページで「px-2.5 py-0.5 rounded-full ...」のピルを都度インライン実装し、
// セマンティックトークンの当て方や文言が画面ごとにぶれていた。本コンポーネントへ集約し、
// 色はトーン（意味）で選び、ラベルは statusLabels.ts の単一の真実の源から解決する。
//
// tone はデザイントークンの用途（規約 §4.2）に対応する:
//   success(emerald) / warning(amber) / danger(rose) / info(sky) /
//   neutral(slate) / brand(emerald) / accent(indigo)

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CAPACITY_STATUS_LABEL,
  ENTRY_KIND_LABEL,
  type EntryKind,
} from "@/components/ui/statusLabels";
import type { CapacityStatus } from "@/features/tournaments/utils/capacity";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand"
  | "accent";

// トーン → セマンティックトークンクラス（規約 §4.2 / §4.3）。ハードコードカラー禁止。
const toneClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-rose-50 text-rose-700 border border-rose-200",
  info: "bg-sky-50 text-sky-700 border border-sky-200",
  neutral: "bg-slate-100 text-slate-600 border border-slate-200",
  brand: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  accent: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

const base =
  "inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold";

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone;
}

// 任意ラベル + トーンの汎用バッジ。children に文言やアイコンを渡す。
export function StatusBadge({
  tone,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(base, toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}

// 空き枠ステータス → トーンの対応（規約 §4.3 サンプルと一致）。
const CAPACITY_TONE: Record<CapacityStatus, BadgeTone> = {
  OPEN: "success",
  FEW: "warning",
  FULL: "danger",
};

// 空き枠ステータスバッジ。ラベル・色ともに単一の真実の源から解決する。
export function CapacityBadge({
  status,
  className,
}: {
  status: CapacityStatus;
  className?: string;
}) {
  return (
    <StatusBadge tone={CAPACITY_TONE[status]} className={className}>
      {CAPACITY_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

// エントリー種別 → トーンの対応。
const ENTRY_KIND_TONE: Record<EntryKind, BadgeTone> = {
  CONFIRMED: "success",
  WAITING: "warning",
  CANCELLED: "neutral",
  ATTENDED: "neutral",
};

// エントリー種別バッジ。ラベルは ENTRY_KIND_LABEL から解決する。
export function EntryKindBadge({
  kind,
  className,
  children,
}: {
  kind: EntryKind;
  className?: string;
  // 既定ラベルの代わりに独自の内容（順位バッジ等）を描画したい場合に使う。
  children?: React.ReactNode;
}) {
  return (
    <StatusBadge tone={ENTRY_KIND_TONE[kind]} className={className}>
      {children ?? ENTRY_KIND_LABEL[kind]}
    </StatusBadge>
  );
}
