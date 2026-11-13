// ランキング順位表。自分の行を強調表示する（色 + 「あなた」ラベルの併用）。
// 公開項目は順位・アイコン・ニックネーム・GRANレベル（種目別は所属階級も）のみ（要件8.4, 8.8, 9.3）。
import type { RankingRowDto } from "@/features/data/types/dto";
import { cn } from "@/lib/utils";

export type PublicRankingRow = Omit<RankingRowDto, "userId">;

function Avatar({ nickname, avatarUrl }: { nickname: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white dark:bg-emerald-500 dark:text-slate-900"
    >
      {nickname.slice(0, 1)}
    </span>
  );
}

export function RankingTable({
  rows,
  showTier,
  caption,
}: {
  rows: PublicRankingRow[];
  /** 種目別のとき所属階級列を表示する */
  showTier: boolean;
  caption: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-bold">順位</th>
            <th scope="col" className="px-3 py-2 text-left font-bold">ユーザー</th>
            {showTier && (
              <th scope="col" className="px-3 py-2 text-left font-bold">階級</th>
            )}
            <th scope="col" className="px-3 py-2 text-right font-bold">GRANレベル</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.rank}-${i}`}
              aria-current={row.isMe ? "true" : undefined}
              className={cn(
                "min-h-[44px] border-t border-slate-200 dark:border-slate-800",
                row.isMe &&
                  "bg-emerald-50 font-bold ring-2 ring-inset ring-emerald-600 dark:bg-emerald-950 dark:ring-emerald-500",
              )}
            >
              <td className="whitespace-nowrap px-3 py-2">{row.rank}位</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <Avatar nickname={row.nickname} avatarUrl={row.avatarUrl} />
                  <span className="min-w-0 break-all">{row.nickname}</span>
                  {row.isMe && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white dark:bg-emerald-500 dark:text-slate-900">
                      あなた
                    </span>
                  )}
                </span>
              </td>
              {showTier && <td className="whitespace-nowrap px-3 py-2">{row.tier}級</td>}
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {row.granLevel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
