// レベル推移パネル（Level_History_View・Client）。
//
// 閲覧ユーザー自身の GRANレベル変動を時系列で表示する。
// - 期間フィルタ（全期間 / 直近1年 / 6ヶ月 / 3ヶ月）を 44px 以上のタッチ
//   ターゲットで提供し、現在選択中には `aria-current` を付与する（Requirement 5.5 / 1.5）。
// - 変動点は軽量な自前 SVG 折れ線（postGranLevel の時系列）で描画する
//   （外部グラフライブラリは導入しない / 設計 Assumption）。
// - グラフに加えて各変動点を常に表（recorded_at / pre / diff / post）で併記し、
//   音声読み上げ可能な HTML テキストとして提供する（Requirement 5.2 / 5.9）。
// - 履歴 0 件は空状態（EmptyState）、期間フィルタ適用後 0 件は「期間内に変動なし」
//   の説明テキストを表示する（Requirement 5.6 / 5.7）。
// - 取得失敗時は ErrorRetry（エラー表示 + 再取得）を提示する（Requirement 5.8）。
//
// 本パネルは server から渡された levelHistory / periodLowerBounds を受け取る。
// エラーはサーバ側で基本的に空へフォールバックされるが、取得失敗を明示できるよう
// 任意の `error` / `onRetry` props を公開する（Requirement 5.8 / 10 の方針整合）。
//
// _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9_
"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/data/components/EmptyState";
import { ErrorRetry } from "@/features/data/components/ErrorRetry";
import type {
  LevelHistoryPoint,
  PeriodFilter,
} from "@/features/data/types/data";

type Props = {
  // レベル推移の変動点（recorded_at 昇順。server から配布）。
  levelHistory: LevelHistoryPoint[];
  // 期間フィルタ選択肢ごとの下限 recorded_at（ALL は null）。
  periodLowerBounds: Record<PeriodFilter, string | null>;
  // 取得失敗を明示する場合に true（既定: false）。true のとき ErrorRetry を表示する。
  error?: boolean;
  // 再取得コールバック（ErrorRetry のボタン押下時）。
  onRetry?: () => void;
  className?: string;
};

// 期間フィルタ選択肢の表示順・ラベル（設計 Decision 論点E）。
const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodFilter; label: string }> = [
  { value: "ALL", label: "全期間" },
  { value: "1Y", label: "1年" },
  { value: "6M", label: "6ヶ月" },
  { value: "3M", label: "3ヶ月" },
];

// SVG 折れ線グラフの描画寸法（viewBox 座標系）。
const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const CHART_PADDING_X = 32;
const CHART_PADDING_Y = 24;

// diff（変動値）を符号付きテキストへ整形する（+5 / -3 / ±0）。
function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return "±0";
}

export function LevelHistoryPanel({
  levelHistory,
  periodLowerBounds,
  error = false,
  onRetry,
  className,
}: Props) {
  const [period, setPeriod] = useState<PeriodFilter>("ALL");

  // 選択中の期間で変動点を絞り込む。
  // 下限が null（全期間）なら全件、そうでなければ recorded_at >= 下限 を残す。
  // recorded_at は `YYYY-MM-DD HH:MM:SS`（辞書順＝時系列順）のため文字列比較で判定できる。
  const filtered = useMemo(() => {
    const lowerBound = periodLowerBounds[period];
    if (lowerBound === null || lowerBound === undefined) {
      return levelHistory;
    }
    return levelHistory.filter((point) => point.recordedAt >= lowerBound);
  }, [levelHistory, periodLowerBounds, period]);

  // SVG 折れ線の座標計算（postGranLevel の時系列）。
  // 変動点が 0 件ならグラフは描画しない。1 件のみの場合は中央に単点を描く。
  const chart = useMemo(() => {
    if (filtered.length === 0) {
      return null;
    }

    const levels = filtered.map((point) => point.postGranLevel);
    const minLevel = Math.min(...levels);
    const maxLevel = Math.max(...levels);
    // Y 軸がゼロ幅（全点同値）になるのを避けるため下駄を履かせる。
    const span = maxLevel - minLevel || 1;

    const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
    const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

    const points = filtered.map((point, index) => {
      const x =
        filtered.length === 1
          ? CHART_WIDTH / 2
          : CHART_PADDING_X +
            (innerWidth * index) / (filtered.length - 1);
      // level が高いほど上（y 小）になるよう反転。
      const y =
        CHART_PADDING_Y +
        innerHeight * (1 - (point.postGranLevel - minLevel) / span);
      return { x, y, point };
    });

    const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

    return { points, polyline, minLevel, maxLevel };
  }, [filtered]);

  // 取得失敗時はエラー表示 + 再取得（他の情報は出さない / Requirement 5.8）。
  if (error) {
    return (
      <section className={cn("space-y-4", className)} aria-label="レベル推移">
        <ErrorRetry
          message="レベル推移データの取得に失敗しました。"
          onRetry={onRetry}
        />
      </section>
    );
  }

  // 履歴 0 件: グラフ領域を表示せず空状態（Requirement 5.6）。
  if (levelHistory.length === 0) {
    return (
      <section className={cn("space-y-4", className)} aria-label="レベル推移">
        <EmptyState
          message="レベル推移の履歴がありません"
          description="大会結果が記録されると、GRANレベルの変動がここに表示されます。"
        />
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)} aria-label="レベル推移">
      {/* 期間フィルタ（44px 以上・aria-current 付き） */}
      <div
        role="group"
        aria-label="期間フィルタ"
        className="flex flex-wrap gap-2"
      >
        {PERIOD_OPTIONS.map((option) => {
          const selected = option.value === period;
          return (
            <button
              key={option.value}
              type="button"
              aria-current={selected ? "true" : undefined}
              aria-pressed={selected}
              onClick={() => setPeriod(option.value)}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center",
                "rounded-lg border px-4 py-2 text-sm font-bold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
                selected
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* 期間内 0 件: 変動が無い旨の説明テキスト（Requirement 5.7） */}
      {filtered.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm font-bold text-slate-500"
        >
          選択した期間内に変動なし
        </p>
      ) : (
        <>
          {/* SVG 折れ線グラフ（postGranLevel の時系列 / 自前描画） */}
          {chart ? (
            <figure className="rounded-xl border border-slate-200 bg-white p-3">
              <figcaption className="sr-only">
                GRANレベルの時系列推移グラフ。詳細は下部の表を参照してください。
              </figcaption>
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                role="img"
                aria-label={`GRANレベル推移。最小 ${chart.minLevel}、最大 ${chart.maxLevel}、変動点 ${filtered.length} 件。`}
                className="h-48 w-full"
                preserveAspectRatio="none"
              >
                {/* 折れ線 */}
                <polyline
                  points={chart.polyline}
                  fill="none"
                  stroke="#059669"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {/* 各変動点 */}
                {chart.points.map((p, index) => (
                  <circle
                    key={index}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill="#059669"
                  />
                ))}
              </svg>
            </figure>
          ) : null}

          {/* 変動点の表（グラフ併記・音声読み上げ可能 / Requirement 5.2 / 5.9） */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <caption className="sr-only">
                各変動点の記録日時・変動前レベル・変動値・変動後レベル
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th scope="col" className="px-3 py-2 font-bold">
                    記録日時
                  </th>
                  <th scope="col" className="px-3 py-2 font-bold">
                    大会
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    変動前
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    変動値
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-bold">
                    変動後
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((point, index) => (
                  <tr
                    key={`${point.recordedAt}-${index}`}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {point.recordedAt}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {point.tournamentTitle ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {point.preGranLevel}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-bold tabular-nums",
                        point.granLevelDiff > 0
                          ? "text-emerald-700"
                          : point.granLevelDiff < 0
                            ? "text-rose-600"
                            : "text-slate-500",
                      )}
                    >
                      {formatDiff(point.granLevelDiff)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                      {point.postGranLevel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
