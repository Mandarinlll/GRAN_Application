"use client";

import { useCallback, useState } from "react";
import { DEFAULT_TIMEOUT_MS, useRemoteResource } from "../../hooks/useRemoteResource";
import type { ChartPointDto, HistoryRowDto } from "../../types/dto";
import { formatDelta } from "../../utils/history";
import { EmptyState, ErrorPanel, Skeleton } from "../RegionState";
import { GranChart } from "./GranChart";
import {
  CARD_CLASS,
  DELTA_COLOR,
  DELTA_ICON,
  NOTE_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECTION_TITLE_CLASS,
  formatDateTime,
} from "./shared";

const PAGE_SIZE = 20;

interface HistoryPage {
  rows: HistoryRowDto[];
  total: number;
  nextOffset: number | null;
  chart?: ChartPointDto[];
}

export function GranHistory() {
  const first = useRemoteResource<HistoryPage>({
    url: `/api/data/me/gran-history?offset=0&limit=${PAGE_SIZE}`,
    keepStaleOnError: true,
  });

  // 「もっと見る」で追加された行（先頭ページとは別に保持し、失敗しても消さない）
  const [extraRows, setExtraRows] = useState<HistoryRowDto[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const firstData = first.data;
  const effectiveNext = nextOffset === undefined ? (firstData?.nextOffset ?? null) : nextOffset;

  const loadMore = useCallback(async () => {
    if (effectiveNext === null) return;
    setLoadingMore(true);
    setMoreError(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(
        `/api/data/me/gran-history?offset=${effectiveNext}&limit=${PAGE_SIZE}`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as HistoryPage;
      setExtraRows((prev) => [...prev, ...page.rows]);
      setNextOffset(page.nextOffset);
    } catch {
      setMoreError(true);
    } finally {
      clearTimeout(timer);
      setLoadingMore(false);
    }
  }, [effectiveNext]);

  const rows = firstData ? [...firstData.rows, ...extraRows] : [];
  const showError = first.status === "error";

  return (
    <section aria-label="GRANレベル履歴" className={`${CARD_CLASS} space-y-3`}>
      <h2 className={SECTION_TITLE_CLASS}>GRANレベルの推移</h2>

      {first.status === "loading" && !firstData && <Skeleton label="履歴を読み込み中" lines={4} />}

      {showError && (
        <ErrorPanel
          message="GRANレベル履歴の取得に失敗しました。"
          onRetry={first.retry}
          consecutiveFailures={first.consecutiveFailures}
        />
      )}

      {firstData && firstData.total === 0 && (
        <EmptyState message="GRANレベルの変動履歴はまだありません。" />
      )}

      {firstData && firstData.total > 0 && (
        <>
          {firstData.chart && firstData.chart.length >= 2 && <GranChart points={firstData.chart} />}

          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => {
              const d = formatDelta(r.diff);
              return (
                <li key={r.id} className="py-2 text-sm">
                  <p className={NOTE_CLASS}>{formatDateTime(r.recordedAt)}</p>
                  <p className="font-bold">{r.tournamentTitle}</p>
                  <p className="tabular-nums">
                    {r.preLevel} → {r.postLevel}{" "}
                    <span className={`font-bold ${DELTA_COLOR[d.direction]}`}>
                      （{d.text}
                      {DELTA_ICON[d.direction] && (
                        <span aria-hidden="true"> {DELTA_ICON[d.direction]}</span>
                      )}
                      ）
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>

          {moreError && (
            <p role="alert" className="text-sm font-bold text-red-700 dark:text-red-300">
              <span aria-hidden="true">⚠ </span>
              履歴の追加読み込みに失敗しました。もう一度お試しください。
            </p>
          )}

          {effectiveNext !== null && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className={`${SECONDARY_BUTTON_CLASS} w-full`}
            >
              {loadingMore ? "読み込み中…" : "もっと見る"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
