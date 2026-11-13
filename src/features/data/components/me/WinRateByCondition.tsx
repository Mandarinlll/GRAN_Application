"use client";

import { useState } from "react";
import { useRemoteResource } from "../../hooks/useRemoteResource";
import type { Bucket, Dimension } from "../../utils/aggregate";
import { winRatePercentInt } from "../../utils/winRate";
import { EmptyState, ErrorPanel, Skeleton } from "../RegionState";
import { CARD_CLASS, NOTE_CLASS, SECTION_TITLE_CLASS } from "./shared";

const DIMENSIONS: Array<{ id: Dimension; label: string }> = [
  { id: "category", label: "種目" },
  { id: "venue", label: "会場" },
  { id: "surface", label: "サーフェス" },
  { id: "season", label: "季節" },
  { id: "opponent", label: "対戦相手（団体戦）" },
  { id: "series", label: "大会シリーズ" },
];

interface WinRateDto {
  dimension: Dimension;
  buckets: Bucket[];
  totalMatches: number;
}

export function WinRateByCondition() {
  const [dimension, setDimension] = useState<Dimension>("category");
  // 失敗時は直前の集計結果を保持する（要件5.11）
  const { status, data, retry, consecutiveFailures } = useRemoteResource<WinRateDto>({
    url: `/api/data/me/win-rate?dimension=${dimension}`,
    keepStaleOnError: true,
  });

  // keepStale は別条件の結果を返しうるため、選択中の条件の結果のみ描画する
  const current = data && data.dimension === dimension ? data : null;
  const stale = data && data.dimension !== dimension ? data : null;

  return (
    <section aria-label="条件別勝率" className={`${CARD_CLASS} space-y-3`}>
      <h2 className={SECTION_TITLE_CLASS}>条件別の勝率</h2>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="winrate-dimension" className="text-sm font-bold">
          条件
        </label>
        <select
          id="winrate-dimension"
          value={dimension}
          onChange={(e) => setDimension(e.target.value as Dimension)}
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-emerald-500"
        >
          {DIMENSIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" className="space-y-3">
        {status === "error" && (
          <ErrorPanel
            message="条件別勝率の取得に失敗しました。"
            onRetry={retry}
            consecutiveFailures={consecutiveFailures}
          />
        )}

        {status === "loading" && !current && <Skeleton label="条件別勝率を読み込み中" lines={4} />}

        {/* 取得失敗時は直前の結果を保持して表示する */}
        {(current ?? (status === "error" ? stale : null)) && (
          <Buckets data={(current ?? stale) as WinRateDto} />
        )}
      </div>
    </section>
  );
}

function Buckets({ data }: { data: WinRateDto }) {
  if (data.buckets.length === 0) {
    return <EmptyState message="集計対象の試合がありません。" />;
  }
  return (
    <>
      {data.totalMatches === 0 && <EmptyState message="集計対象の試合がありません。" />}
      <ul className="space-y-3">
        {data.buckets.map((b) => {
          const pct = winRatePercentInt(b.wins, b.matches);
          return (
            <li key={b.key} className="text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-bold">{b.label}</span>
                <span className="tabular-nums">
                  {b.matches}試合 {b.wins}勝 {b.losses}敗{" "}
                  <span className="font-bold">{pct === null ? "-" : `${pct}%`}</span>
                </span>
              </div>
              <div
                className="mt-1 h-3 w-full overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800"
                role="img"
                aria-label={`${b.label}の勝率 ${pct === null ? "なし" : `${pct}%`}`}
              >
                <div
                  className="h-full rounded-xl bg-emerald-600 dark:bg-emerald-500"
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className={NOTE_CLASS}>結果が確定した試合のみ集計しています。</p>
    </>
  );
}

