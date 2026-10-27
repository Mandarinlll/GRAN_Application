// 成績サマリカード（Performance_Summary_View・Client）。
//
// 閲覧ユーザー自身の成績サマリ指標を表示する（Requirement 9）。
//   - 総出場回数（totalEntries）/ 優勝回数（winCount）/ 準優勝回数（runnerUpCount）
//     を HTML テキストで表示する（9.1）。
//   - tournament_results が 0 件のときは各指標を 0 として表示する（9.4）。
//   - 勝率（winRate）は論点Dにより当面未算出（null）。null のときはダッシュ
//     「—」を表示し、値があるときは百分率で整形する（9.3）。
//   - 取得失敗時は指標値を表示せず ErrorRetry（エラー表示 + 再取得）を提示する（9.5）。
//
// 重要情報は HTML テキスト化し、再取得は 44px 以上のタッチターゲット + aria を
// 満たす（ErrorRetry へ委譲 / Requirement 1.5 / 1.7）。
//
// _Requirements: 9.1, 9.3, 9.4, 9.5_
"use client";

import type { PerformanceSummary } from "@/features/data/types/data";
import { ErrorRetry } from "./ErrorRetry";

type Props = {
  // 成績サマリ指標（DataViewData 由来・自身のみ）。
  performanceSummary: PerformanceSummary;
  // 取得失敗フラグ。true のとき ErrorRetry を表示する（9.5）。
  error?: boolean;
  // 再取得ボタン押下時のコールバック（ErrorRetry へ委譲）。
  onRetry?: () => void;
};

// 件数系指標の表示定義（総出場 / 優勝 / 準優勝）。
// 0 件時も 0 をそのまま表示する（9.4）。
const COUNT_METRICS: {
  key: "totalEntries" | "winCount" | "runnerUpCount";
  label: string;
}[] = [
  { key: "totalEntries", label: "総出場回数" },
  { key: "winCount", label: "優勝回数" },
  { key: "runnerUpCount", label: "準優勝回数" },
];

// 勝率を百分率テキストへ整形する（小数点以下第1位まで）。
// winRate は 0〜1 の割合を想定し、100 倍して % を付与する。
function formatWinRate(winRate: number): string {
  return `${(winRate * 100).toFixed(1)}%`;
}

export function PerformanceSummaryCard({
  performanceSummary,
  error,
  onRetry,
}: Props) {
  // 取得失敗時はエラー表示 + 再取得のみを提示する（9.5）。
  if (error) {
    return (
      <ErrorRetry
        message="成績サマリの取得に失敗しました。"
        onRetry={onRetry}
      />
    );
  }

  const { winRate } = performanceSummary;

  return (
    <section aria-label="成績サマリ" className="flex flex-col gap-3">
      {/* 件数系指標（総出場 / 優勝 / 準優勝）。0 件も 0 表示（9.4）。 */}
      <dl className="grid grid-cols-3 gap-2">
        {COUNT_METRICS.map((metric) => (
          <div
            key={metric.key}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center"
          >
            <dt className="text-[11px] font-bold text-slate-400">
              {metric.label}
            </dt>
            <dd className="text-2xl font-bold tabular-nums text-slate-800">
              {performanceSummary[metric.key]}
            </dd>
          </div>
        ))}
      </dl>

      {/* 勝率（winRate）。null のときはダッシュ「—」（9.3）。 */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-bold text-slate-500">勝率</span>
        {winRate === null ? (
          <span
            className="text-xl font-bold text-slate-400"
            aria-label="勝率は未算出です"
          >
            —
          </span>
        ) : (
          <span className="text-xl font-bold tabular-nums text-slate-800">
            {formatWinRate(winRate)}
          </span>
        )}
      </div>
    </section>
  );
}
