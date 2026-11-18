// 管理コンソール用のアカウント表示ボタン（ユーザー画面のサイドバー左下と同じ見た目）。
// 押下で設定画面へ移動する。サーバーコンポーネント。
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SETTINGS_HREF } from "@/components/layout/navConfig";
import { granLevelToClassLabel } from "@/features/auth/utils/classLabel";

type Props = {
  realName: string;
  avatarText: string;
  granLevel: number;
  roleLabel: string;
  // sidebar: PC 用の幅いっぱい表示 / compact: モバイル用の小型表示
  variant: "sidebar" | "compact";
};

export function AdminUserCard({ realName, avatarText, granLevel, roleLabel, variant }: Props) {
  const classLabel = granLevelToClassLabel(granLevel);
  const compact = variant === "compact";
  return (
    <Link
      href={SETTINGS_HREF}
      aria-label="設定を開く"
      className={cn(
        "flex items-center gap-2.5 p-2 min-h-[44px] rounded-xl border border-slate-200/80 bg-slate-50 transition hover:bg-slate-100",
        compact && "rounded-full py-1 px-2.5",
      )}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {avatarText}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-slate-800 truncate">
          {realName}
          <span className="ml-1.5 inline-block text-[10px] leading-none font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white align-text-top">
            {roleLabel}
          </span>
        </div>
        {!compact && (
          <div className="text-xs text-slate-500 truncate">
            Rate: <span className="font-bold text-emerald-600 tabular-nums">{granLevel}</span> ({classLabel})
          </div>
        )}
      </div>
      {!compact && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
    </Link>
  );
}
