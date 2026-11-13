import type { RecentMatchDto } from "../../types/dto";
import { NOTE_CLASS, formatDate } from "./shared";

/** 直近試合。勝敗は文字（勝/敗）と色の両方で区別する。 */
export function RecentMatches({ matches }: { matches: RecentMatchDto[] }) {
  if (matches.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold">直近の試合</h3>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {matches.map((m) => {
          const win = m.result === "WIN";
          return (
            <li key={m.matchId} className="flex items-start gap-3 py-2 text-sm">
              <span
                className={
                  win
                    ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                    : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 font-bold text-red-800 dark:bg-red-900 dark:text-red-100"
                }
              >
                {win ? "勝" : "敗"}
              </span>
              <div className="min-w-0 flex-1">
                <p className={NOTE_CLASS}>{formatDate(m.eventDate)}</p>
                <p className="font-bold">{m.tournamentTitle}</p>
                <p>
                  vs {m.opponent}　スコア: {m.score ?? "-"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
