"use client";

import { useEffect, useRef } from "react";
import { CATEGORY_LABEL } from "@/features/tournaments/types/tournament";
import { useRemoteResource } from "../../hooks/useRemoteResource";
import type { ParticipationDetailDto } from "../../types/dto";
import { formatDelta } from "../../utils/history";
import { resultLabel } from "../../utils/participation";
import { ErrorPanel, Skeleton } from "../RegionState";
import { DIVISION_LABEL } from "./ParticipationFilters";
import { formatDateSlash } from "./ParticipationTable";

const OUTCOME: Record<
  ParticipationDetailDto["matches"][number]["outcome"],
  { text: string; className: string }
> = {
  WIN: { text: "◯ 勝ち", className: "text-emerald-700 dark:text-emerald-400" },
  LOSS: { text: "✕ 負け", className: "text-red-700 dark:text-red-400" },
  DRAW: { text: "△ 引き分け", className: "text-slate-900 dark:text-slate-100" },
  UNDECIDED: { text: "未確定", className: "italic text-slate-700 dark:text-slate-300" },
};

const UNDECIDED = (
  <span className="italic text-slate-700 dark:text-slate-300">
    <span aria-hidden="true">⏳ </span>未確定
  </span>
);

export function ParticipationDetail({
  tournamentId,
  onClose,
}: {
  tournamentId: string;
  /** 閉じる操作（閉じるボタン・Esc）。履歴を戻す処理は呼び出し側が行う。 */
  onClose: () => void;
}) {
  const { status, data, consecutiveFailures, retry } = useRemoteResource<ParticipationDetailDto>({
    url: `/api/data/participations/${encodeURIComponent(tournamentId)}`,
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const f = dialogRef.current.querySelectorAll<HTMLElement>(
        "button, [href], [tabindex]:not([tabindex='-1'])",
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const d = data;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="participation-detail-title"
        onKeyDown={onKeyDown}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="participation-detail-title" className="text-base font-bold">
            {d ? d.title : "出場詳細"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 px-3 text-sm font-bold hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-800 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-500"
          >
            閉じる
          </button>
        </div>

        <div className="mt-4">
          {status === "loading" && <Skeleton label="出場詳細を読み込み中" lines={5} />}
          {status === "error" && (
            <ErrorPanel
              message="出場詳細の取得に失敗しました。"
              onRetry={retry}
              consecutiveFailures={consecutiveFailures}
            />
          )}
          {status === "success" && d && (
            <div className="space-y-4">
              {!d.isResultConfirmed && (
                <p
                  role="status"
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-900 dark:border-amber-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <span aria-hidden="true">⏳ </span>結果は未確定です。
                </p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-700 dark:text-slate-300">開催年月日</dt>
                <dd>{formatDateSlash(d.eventDate)}</dd>
                <dt className="text-slate-700 dark:text-slate-300">会場</dt>
                <dd>{d.venue}</dd>
                <dt className="text-slate-700 dark:text-slate-300">種目</dt>
                <dd>{d.genderDivision ? DIVISION_LABEL[d.genderDivision] : CATEGORY_LABEL[d.category]}</dd>
                <dt className="text-slate-700 dark:text-slate-300">階級</dt>
                <dd>{d.tier}級</dd>
                <dt className="text-slate-700 dark:text-slate-300">結果</dt>
                <dd>{d.result === null ? UNDECIDED : resultLabel(d.result)}</dd>
              </dl>

              <section aria-labelledby="pd-matches">
                <h3 id="pd-matches" className="mb-2 text-sm font-bold">試合結果</h3>
                {d.matches.length === 0 ? (
                  <p className="text-sm text-slate-700 dark:text-slate-300">試合の記録はありません。</p>
                ) : (
                  <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
                    {d.matches.map((m, i) => {
                      const o = OUTCOME[m.outcome];
                      return (
                        <li key={i} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-3 py-2">
                          <span className="text-xs text-slate-700 dark:text-slate-300">R{m.round}</span>
                          <span className="min-w-0">
                            <span className="block break-words">{m.opponent}</span>
                            <span className="block text-xs text-slate-700 dark:text-slate-300">
                              スコア: {m.score ?? (m.outcome === "UNDECIDED" ? UNDECIDED : "-")}
                            </span>
                          </span>
                          <span className={`font-bold ${o.className}`}>{o.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="pd-gran">
                <h3 id="pd-gran" className="mb-2 text-sm font-bold">GRANレベルの変動</h3>
                {d.granChange === null ? (
                  <p className="text-sm">
                    変動値: {UNDECIDED}
                  </p>
                ) : (
                  (() => {
                    const delta = formatDelta(d.granChange.diff);
                    const icon = delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "";
                    return (
                      <p className="text-sm">
                        {d.granChange.pre} → {d.granChange.post}（変動値 {delta.text}
                        {icon && <span aria-hidden="true"> {icon}</span>}）
                      </p>
                    );
                  })()
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
