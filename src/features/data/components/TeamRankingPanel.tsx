// チームランキングパネル（Team_Ranking_View）。
//
// チームGRANレベル指標（有効メンバー平均レート）の降順に並んだチーム一覧を表示する。
// 各行は チーム順位／チームアイコン（未設定は既定のプレースホルダーアイコン）／
// チーム名／代表者ニックネーム／チームGRANレベル指標 を扱う。
//
// - 順位・チーム名・代表者ニックネーム・チームGRANレベル指標は画像ではなく
//   HTML テキストとして表示する（Requirement 1.7 / 8.3）。
// - チームアイコンが未設定／取得不能のときは既定のプレースホルダーアイコンを表示し、
//   他項目は引き続き表示する（Requirement 4.3）。RankRow のアバター描画パターンに倣う。
// - 公開情報（チーム名／チームアイコン／代表者ニックネーム／チームGRANレベル指標／順位）
//   のみを扱い、本名などの非公開項目は props に受け取らない（Requirement 8.4 / Property 10）。
// - 対象チームが 0 件のときは空状態を表示する（Requirement 4.8 / 4.9）。
// - インタラクティブ要素は 44px 以上のタッチターゲットとする（Requirement 1.5）。
"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/data/components/EmptyState";
import type { RankedTeam } from "@/features/data/types/data";

type Props = {
  // チームランキング（teamRating 降順・順位付与済み）。有効メンバー 0 のチームは除外済み。
  teamRanking: RankedTeam[];
  className?: string;
};

export function TeamRankingPanel({ teamRanking, className }: Props) {
  // 対象チームが 0 件: 空状態（Requirement 4.8 / 4.9）。
  if (teamRanking.length === 0) {
    return (
      <section className={cn("space-y-3", className)} aria-label="チームランキング">
        <h2 className="text-base font-bold text-slate-900">チームランキング</h2>
        <EmptyState
          message="対象チームがありません"
          description="ランキング対象となるチームが登録されていないか、有効なGRANレベルを持つメンバーが存在しません。"
        />
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)} aria-label="チームランキング">
      <h2 className="text-base font-bold text-slate-900">チームランキング</h2>
      <ol className="space-y-2">
        {teamRanking.map((team) => (
          <TeamRankRow key={team.id} team={team} />
        ))}
      </ol>
    </section>
  );
}

// チームランキング 1 行。RankRow のレイアウト/スタイルに倣う。
function TeamRankRow({ team }: { team: RankedTeam }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors">
      {/* チーム順位（HTMLテキスト） */}
      <span className="w-10 shrink-0 text-center">
        <span className="sr-only">チーム順位</span>
        <span className="text-base font-bold tabular-nums text-slate-900">
          {team.rank}
        </span>
        <span className="ml-0.5 text-[10px] text-slate-400">位</span>
      </span>

      {/* チームアイコン or プレースホルダーアイコン（未設定時） */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
        {team.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users className="h-5 w-5" aria-hidden="true" />
        )}
      </span>

      {/* チーム名 + 代表者ニックネーム */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-800">
          <span className="sr-only">チーム名 </span>
          {team.name}
        </span>
        <span className="block truncate text-xs text-slate-500">
          <span className="sr-only">代表者 </span>
          代表者: {team.leaderNickname}
        </span>
      </span>

      {/* チームGRANレベル指標（HTMLテキスト） */}
      <span className="shrink-0 text-right">
        <span className="sr-only">チームGRANレベル指標</span>
        <span className="text-base font-bold tabular-nums text-emerald-700">
          {team.teamRating}
        </span>
      </span>
    </li>
  );
}
