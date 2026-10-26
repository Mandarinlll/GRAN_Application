// 大会要項ポスター画像のプレースホルダー。
// image_url が未設定の大会向けに、視覚的な代替を表示する。
// ※重要情報は必ずテキストで別途表示する（ui-design-system.md 9 のテキスト化ルール）。
// このプレースホルダーはあくまで視覚的補足。
//
// variant で表示密度を切り替える:
//  - "card"   : カード上部の 3:4（縦長）領域向け。溢れを防ぎつつ必要十分な情報を表示。
//  - "full"   : 要項ビューア／全画面の 9:16（縦長・広い）領域向け。詳細を表示。

import { Trophy } from "lucide-react";
import { CATEGORY_LABEL, TIER_LABEL } from "@/features/tournaments/types/tournament";
import type { TournamentCardData } from "@/features/tournaments/types/view";

type Props = {
  tournament: TournamentCardData;
  variant?: "card" | "full";
};

export function FlyerPlaceholder({ tournament, variant = "full" }: Props) {
  if (variant === "card") {
    // 3:4 の縦長領域向け。縦に余裕ができたぶん、種目/階級・大会名・開催日まで表示する。
    // タイトルは3行省略に抑え、溢れを防ぐ。詳細は要項ビューアで確認できる。
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-700 text-white px-3 py-3 text-center select-none overflow-hidden">
        <Trophy className="w-8 h-8 mb-2 opacity-90 shrink-0" />
        <div className="text-xs font-bold opacity-80 leading-tight line-clamp-1">
          {CATEGORY_LABEL[tournament.category]} / {TIER_LABEL[tournament.tier]}
        </div>
        <div className="text-sm font-bold leading-snug line-clamp-3 mt-1">
          {tournament.title}
        </div>
        <div className="text-xs tabular-nums opacity-90 mt-2">
          {tournament.eventDateLabel}
        </div>
      </div>
    );
  }

  // 9:16 の縦長・広い領域向けの詳細表示。
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-700 text-white p-4 text-center select-none overflow-hidden">
      <Trophy className="w-10 h-10 mb-3 opacity-90 shrink-0" />
      <div className="text-xs font-bold opacity-80 mb-1 line-clamp-1">
        {CATEGORY_LABEL[tournament.category]} / {TIER_LABEL[tournament.tier]}
      </div>
      <div className="text-sm font-bold leading-snug mb-3 line-clamp-4">
        {tournament.title}
      </div>
      <div className="text-xs tabular-nums opacity-90">
        {tournament.eventDateLabel}
      </div>
      <div className="text-xs opacity-80 mt-0.5 line-clamp-1">
        {tournament.venue}
      </div>
      <div className="mt-4 text-xs opacity-70">要項ポスター画像は準備中です</div>
    </div>
  );
}
