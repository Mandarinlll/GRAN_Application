// エントリー状況メーター（残り枠のデータバー + 状況色分け）。
//
// 従来は「残りわずか等のバッジ」と「残りN/M枠のテキスト」を別々に表示していたが、
// 本コンポーネントで一本化する:
//   - 横軸バー: 充足率（確定数 / 定員）を可視化し、残り枠を直感的に示す
//   - 色      : エントリー状況で変化（受付中=emerald / 残りわずか=amber / 満員=rose /
//               自チーム申込中=purple / 受付終了系=slate）
//   - ラベル  : 状況名と残り枠数を併記
//
// variant:
//   - "compact": カード・一覧表向け（1行・小さめ）
//   - "full"   : 要項ビューア向け（見出し + バー + 補足）

import { cn } from "@/lib/utils";
import type { CapacityStatus } from "@/features/tournaments/utils/capacity";
import type { TournamentStatus } from "@/features/tournaments/types/tournament";

type Tone = "open" | "few" | "full" | "entered" | "closed";

// 表示状態（色・ラベル）を解決する。
// 受付終了系（OPEN 以外のライフサイクル）を最優先、次に自チーム申込中、
// 続いて空き状況（満員/残りわずか/空きあり）の順で判定する。
function resolveTone(params: {
  capacityStatus: CapacityStatus;
  lifecycleStatus: TournamentStatus;
  isPast: boolean;
  isEntered: boolean;
}): { tone: Tone; label: string } {
  const { capacityStatus, lifecycleStatus, isPast, isEntered } = params;

  // 受付中でない / 過去開催は受付終了系として扱う。
  if (isPast || lifecycleStatus !== "OPEN") {
    const label =
      lifecycleStatus === "FINISHED" || isPast
        ? "終了"
        : lifecycleStatus === "CLOSED"
          ? "締め切り"
          : lifecycleStatus === "CANCELLED"
            ? "中止"
            : lifecycleStatus === "UPCOMING"
              ? "受付前"
              : "受付対象外";
    return { tone: "closed", label };
  }

  if (isEntered) return { tone: "entered", label: "自チーム申込中" };

  if (capacityStatus === "FULL") return { tone: "full", label: "満員 (キャンセル待ち)" };
  if (capacityStatus === "FEW") return { tone: "few", label: "残りわずか" };
  return { tone: "open", label: "空き枠あり" };
}

// トーンごとのバー色・テキスト色。
const TONE_BAR: Record<Tone, string> = {
  open: "bg-emerald-500",
  few: "bg-amber-500",
  full: "bg-rose-500",
  entered: "bg-purple-500",
  closed: "bg-slate-400",
};
const TONE_TEXT: Record<Tone, string> = {
  open: "text-emerald-700",
  few: "text-amber-700",
  full: "text-rose-700",
  entered: "text-purple-700",
  closed: "text-slate-500",
};

export interface CapacityMeterProps {
  capacity: number;
  confirmedCount: number;
  remaining: number;
  capacityStatus: CapacityStatus;
  lifecycleStatus: TournamentStatus;
  isPast: boolean;
  isEntered: boolean;
  waitingCount?: number;
  variant?: "compact" | "full";
  className?: string;
}

export function CapacityMeter({
  capacity,
  confirmedCount,
  remaining,
  capacityStatus,
  lifecycleStatus,
  isPast,
  isEntered,
  waitingCount = 0,
  variant = "compact",
  className,
}: CapacityMeterProps) {
  const { tone, label } = resolveTone({
    capacityStatus,
    lifecycleStatus,
    isPast,
    isEntered,
  });

  // 充足率（0〜100%）。満員・終了は 100% 表示。
  const pct =
    capacity <= 0
      ? 100
      : Math.min(100, Math.round((confirmedCount / capacity) * 100));

  // 残り枠の文言（受付終了系では枠表示を控える）。
  const remainLabel =
    tone === "closed"
      ? ""
      : tone === "full"
        ? waitingCount > 0
          ? `待ち ${waitingCount}件`
          : "残り 0枠"
        : `残り ${remaining}枠`;

  if (variant === "full") {
    return (
      <div
        className={cn(
          "p-3.5 bg-white border border-slate-200 rounded-xl space-y-2",
          className,
        )}
      >
        <div className="flex items-center justify-between text-xs font-bold">
          <span className={cn("flex items-center gap-1.5", TONE_TEXT[tone])}>
            <span
              className={cn("inline-block w-2 h-2 rounded-full", TONE_BAR[tone])}
            />
            {label}
          </span>
          <span className="text-slate-600 tabular-nums">
            確定 {confirmedCount}枠 / 定員 {capacity}枠
            {tone !== "closed" && `（${remainLabel}）`}
          </span>
        </div>
        <Bar pct={pct} tone={tone} />
        {waitingCount > 0 && (
          <div className="text-xs text-slate-400 tabular-nums">
            キャンセル待ち: {waitingCount}件
          </div>
        )}
      </div>
    );
  }

  // compact: カード・一覧表向け。
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-bold truncate", TONE_TEXT[tone])}>{label}</span>
        {remainLabel && (
          <span className="text-slate-500 tabular-nums whitespace-nowrap shrink-0">
            {remainLabel}
          </span>
        )}
      </div>
      <Bar pct={pct} tone={tone} />
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: Tone }) {
  return (
    <div
      className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="エントリー充足率"
    >
      <div
        className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
