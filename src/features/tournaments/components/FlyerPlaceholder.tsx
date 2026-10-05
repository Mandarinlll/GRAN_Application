// 大会要項ポスター画像のプレースホルダー。
// image_url が未設定の大会向けに、16:9 縦長（9:16）の視覚的な代替を表示する。
// ※重要情報は必ずテキストで別途表示する（ui-design-system.md 9 のテキスト化ルール）。
// このプレースホルダーはあくまで視覚的補足。

import { Trophy } from "lucide-react";
import { CATEGORY_LABEL, TIER_LABEL } from "@/features/tournaments/types/tournament";
import type { TournamentCardData } from "@/features/tournaments/types/view";

export function FlyerPlaceholder({ tournament }: { tournament: TournamentCardData }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-700 text-white p-4 text-center select-none">
      <Trophy className="w-10 h-10 mb-3 opacity-90" />
      <div className="text-xs font-bold opacity-80 mb-1">
        {CATEGORY_LABEL[tournament.category]} / {TIER_LABEL[tournament.tier]}
      </div>
      <div className="text-sm font-bold leading-snug mb-3 line-clamp-4">
        {tournament.title}
      </div>
      <div className="text-xs tabular-nums opacity-90">
        {tournament.eventDateLabel}
      </div>
      <div className="text-xs opacity-80 mt-0.5">{tournament.venue}</div>
      <div className="mt-4 text-xs opacity-70">
        要項ポスター画像は準備中です
      </div>
    </div>
  );
}
