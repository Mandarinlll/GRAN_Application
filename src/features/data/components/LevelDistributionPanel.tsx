// レベル分布パネル（Level_Distribution_View・Client）。
//
// 査定済ユーザーの GRANレベル分布を 8 段階の規定階級区間（A→DE）ごとに
// div ベースの横棒ヒストグラムで表示する（外部グラフライブラリ非依存 /
// 設計 Assumption「グラフライブラリ」）。
//
// 主な責務:
//   - 全体 / 階級別の表示切替（全体は 8 区間すべて、階級別は閲覧ユーザー自身の
//     階級区間を強調してスコープ表示する / Requirement 7.3）。
//   - 各区間の件数に比例した棒幅のヒストグラム（Requirement 7.1 / 7.2）。
//   - 各区間の下限 / 上限 / 人数を音声読み上げ可能な HTML テーブルで併記する
//     （Requirement 7.6）。
//   - 閲覧ユーザー自身の GRANレベルが属する区間へ位置インジケータを表示する。
//     未査定（is_level_calibrated=false）/ 未確定時はインジケータを非表示とし、
//     位置が確定していない旨の説明テキストを表示する（Requirement 7.4 / 7.5）。
//   - 有効レベルを持つ対象ユーザーが 0 名なら空状態を表示する（Requirement 7.7）。
//   - 操作可能なタッチターゲットは 44px 以上、重要情報は HTML テキスト
//     （Requirement 1.5 / 1.7）。
//
// _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/data/components/EmptyState";
import type {
  DistributionBin,
  SelfRankSummary,
} from "@/features/data/types/data";
import type { TournamentTier } from "@/features/tournaments/types/tournament";

type Props = {
  // レベル分布（8 区間・A→DE の降順。各区間は件数集計済み）。
  distribution: DistributionBin[];
  // 閲覧ユーザー自身のサマリ（自身位置インジケータ判定に用いる）。
  selfRankSummary: SelfRankSummary;
  // 未査定（別枠表示用）ユーザー数。補足説明に用いる（任意）。
  uncalibratedCount?: number;
  className?: string;
};

// 表示単位（論点C / Requirement 7.3）。
type Scope = "ALL" | "TIER";

const SCOPE_TABS: readonly { id: Scope; label: string }[] = [
  { id: "ALL", label: "全体" },
  { id: "TIER", label: "階級別" },
] as const;

export function LevelDistributionPanel({
  distribution,
  selfRankSummary,
  uncalibratedCount,
  className,
}: Props) {
  const [scope, setScope] = useState<Scope>("ALL");

  // 対象母集団（査定済）の合計人数。
  const totalCount = distribution.reduce((sum, bin) => sum + bin.count, 0);

  // 母集団 0 名なら空状態（Requirement 7.7）。
  if (totalCount === 0) {
    return (
      <section className={cn("space-y-4", className)} aria-label="レベル分布">
        <EmptyState
          message="レベル分布を表示できません"
          description="有効なGRANレベルを持つ対象ユーザーがまだいません。ユーザーのレベル査定が完了すると分布が表示されます。"
        />
      </section>
    );
  }

  // 自身位置インジケータの表示可否（査定済のみ表示 / Requirement 7.4・7.5）。
  const showSelfIndicator = selfRankSummary.isCalibrated;
  const selfTier: TournamentTier = selfRankSummary.tier;

  // 階級別表示では閲覧ユーザー自身の階級区間へスコープする。未査定で区間が
  // 定まらない場合は全区間を表示（インジケータは非表示のまま）。
  const scopedBins =
    scope === "TIER" && showSelfIndicator
      ? distribution.filter((bin) => bin.tier === selfTier)
      : distribution;

  // 棒幅算出用の最大件数（0 除算回避のため最低 1）。
  const maxCount = Math.max(1, ...distribution.map((bin) => bin.count));

  return (
    <section className={cn("space-y-4", className)} aria-label="レベル分布">
      {/* 表示単位の切替（全体 / 階級別）。44px 以上のタッチターゲット。 */}
      <div
        role="tablist"
        aria-label="分布の表示単位"
        className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
      >
        {SCOPE_TABS.map((tab) => {
          const isActive = scope === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "true" : undefined}
              onClick={() => setScope(tab.id)}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center",
                "rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                isActive
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 自身位置の説明（未査定時は確定していない旨を表示 / Requirement 7.5）。 */}
      {showSelfIndicator ? (
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            あなたのGRANレベルは {selfRankSummary.granLevel}（{selfTier}級）です。
            該当区間を強調表示しています。
          </span>
        </p>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          あなたのGRANレベルは査定中のため、分布上の位置は確定していません。
          レベル査定が完了すると、該当区間に位置インジケータが表示されます。
        </p>
      )}

      {/* ヒストグラム（div バー）。各区間を件数に比例した棒幅で描画する。 */}
      <div className="space-y-2" aria-hidden="true">
        {scopedBins.map((bin) => {
          const isSelfBin = showSelfIndicator && bin.tier === selfTier;
          const widthPct =
            bin.count === 0 ? 0 : Math.max(2, (bin.count / maxCount) * 100);
          return (
            <div key={bin.tier} className="flex items-center gap-3">
              {/* 階級ラベル */}
              <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-700">
                {bin.tier}
              </span>
              {/* バー領域 */}
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                <div
                  className={cn(
                    "flex h-full items-center rounded-md px-2 transition-all",
                    isSelfBin ? "bg-emerald-500" : "bg-slate-300",
                  )}
                  style={{ width: `${widthPct}%` }}
                >
                  {isSelfBin ? (
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-white" />
                  ) : null}
                </div>
              </div>
              {/* 件数（HTMLテキスト） */}
              <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">
                {bin.count}
                <span className="ml-0.5 text-[10px] font-normal text-slate-400">
                  人
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 各区間の下限 / 上限 / 人数の表併記（音声読み上げ可能 / Requirement 7.6）。 */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <caption className="sr-only">
            規定階級ごとのGRANレベル区間と該当人数
          </caption>
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th scope="col" className="px-3 py-2 text-left font-bold">
                階級
              </th>
              <th scope="col" className="px-3 py-2 text-right font-bold">
                下限
              </th>
              <th scope="col" className="px-3 py-2 text-right font-bold">
                上限
              </th>
              <th scope="col" className="px-3 py-2 text-right font-bold">
                人数
              </th>
            </tr>
          </thead>
          <tbody>
            {scopedBins.map((bin) => {
              const isSelfBin = showSelfIndicator && bin.tier === selfTier;
              return (
                <tr
                  key={bin.tier}
                  aria-current={isSelfBin ? "true" : undefined}
                  className={cn(
                    "border-t border-slate-100",
                    isSelfBin ? "bg-emerald-50" : "bg-white",
                  )}
                >
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-bold text-slate-700"
                  >
                    {bin.tier}級
                    {isSelfBin ? (
                      <span className="sr-only">（あなたの区間）</span>
                    ) : null}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {bin.lower}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {bin.upper}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800">
                    {bin.count} 人
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 母集団・未査定人数の補足（Decision 論点C）。 */}
      <p className="text-xs text-slate-400">
        対象ユーザー: 合計 {totalCount} 人（査定済）
        {typeof uncalibratedCount === "number" && uncalibratedCount > 0
          ? `・査定中 ${uncalibratedCount} 人は分布対象外`
          : ""}
      </p>
    </section>
  );
}
