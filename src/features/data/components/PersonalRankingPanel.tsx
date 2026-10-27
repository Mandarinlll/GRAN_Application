// 個人ランキングパネル（データタブ）。
//
// 全体ランキングと 8 段階の規定階級内ランキングをタブ/フィルターで切り替えて
// 表示する（Requirement 2.1 / 3.1）。各行は RankRow で描画し、閲覧ユーザー
// 自身の行をハイライト + 音声読み上げ用テキストで区別する（Requirement 2.4 / 3.4）。
//
// ヘッダには SelfRankSummary（自身の順位 / 母集団総人数 / 自身の GRANレベル）を
// 表示し、自身が母集団に含まれない（査定中 / 対象外）場合は順位を「対象外」の
// テキストで表示する（Requirement 2.5 / 2.6 / 3.4）。対象が 0 名のときは空状態を
// 表示する（Requirement 2.7 / 3.5）。
//
// 公開プロフィール項目（ニックネーム / アイコン / GRANレベル / 順位）のみを扱い、
// 非公開項目は一切描画しない（Requirement 2.2 / 2.3 / Property 10）。
//
// _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.4, 3.5_
"use client";

import { useMemo, useState } from "react";
import { RankRow } from "@/features/data/components/RankRow";
import { EmptyState } from "@/features/data/components/EmptyState";
import { TIER_LABEL } from "@/features/tournaments/types/tournament";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type { RankedUser, SelfRankSummary } from "@/features/data/types/data";
import { cn } from "@/lib/utils";

// タブのフィルター種別。"OVERALL"（全体）＋ 8 階級。
type RankingFilter = "OVERALL" | TournamentTier;

// タブ表示順（全体 → A → DE の降順）。
const FILTER_ORDER: readonly RankingFilter[] = [
  "OVERALL",
  "A",
  "AB",
  "B",
  "BC",
  "C",
  "CD",
  "D",
  "DE",
] as const;

// フィルター種別 → タブのラベル。
function filterLabel(filter: RankingFilter): string {
  return filter === "OVERALL" ? "全体" : TIER_LABEL[filter];
}

type Props = {
  // 全体ランキング（査定済・順位付与済み・GRANレベル降順）。
  personalRanking: RankedUser[];
  // 階級内ランキング（8 階級分を事前計算）。
  tierRankings: Record<TournamentTier, RankedUser[]>;
  // 閲覧ユーザー自身のサマリ（順位 / 総人数 / 自身レベル）。
  selfRankSummary: SelfRankSummary;
  // 閲覧ユーザーの loginId（CurrentUser.displayId）。自身行の判定に用いる。
  selfLoginId: string;
  className?: string;
};

export function PersonalRankingPanel({
  personalRanking,
  tierRankings,
  selfRankSummary,
  selfLoginId,
  className,
}: Props) {
  // 初期表示は全体ランキング（Requirement 2.1）。
  const [activeFilter, setActiveFilter] = useState<RankingFilter>("OVERALL");

  // 選択中タブに対応する一覧。全体は全体ランキング、階級は該当階級の一覧。
  const rows = useMemo<RankedUser[]>(() => {
    if (activeFilter === "OVERALL") return personalRanking;
    return tierRankings[activeFilter] ?? [];
  }, [activeFilter, personalRanking, tierRankings]);

  return (
    <section
      aria-label="個人ランキング"
      className={cn("space-y-4", className)}
    >
      {/* 自身サマリ（順位 / 総人数 / 自身レベル）。全体ランキング基準で表示する。 */}
      <SelfSummaryHeader summary={selfRankSummary} />

      {/* 全体 + 8 階級の切替タブ。各タブは 44px 以上のタッチターゲット。 */}
      <div
        role="tablist"
        aria-label="ランキングの表示範囲"
        className="flex flex-wrap gap-2"
      >
        {FILTER_ORDER.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "true" : undefined}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 text-sm font-bold transition-colors",
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {filterLabel(filter)}
            </button>
          );
        })}
      </div>

      {/* 一覧（空状態 or RankRow リスト）。 */}
      {rows.length === 0 ? (
        <EmptyState
          message="ランキング対象のユーザーがいません"
          description={
            activeFilter === "OVERALL"
              ? "査定済みのユーザーが登録されると、ここに表示されます。"
              : `${filterLabel(activeFilter)}に該当する査定済みのユーザーがいません。`
          }
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((user) => (
            <RankRow
              key={user.id}
              rank={user.rank}
              nickname={user.nickname}
              avatarUrl={user.avatarUrl}
              granLevel={user.granLevel}
              isSelf={user.loginId === selfLoginId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// 自身サマリのヘッダ表示。
// 順位（査定中/対象外は「対象外」）/ 母集団総人数 / 自身の GRANレベル を
// HTMLテキストで表示する（Requirement 2.5 / 2.6 / 1.7）。
function SelfSummaryHeader({ summary }: { summary: SelfRankSummary }) {
  const { overallRank, totalCount, granLevel, classLabel } = summary;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
      <p className="mb-2 text-xs font-bold text-emerald-700">あなたの順位</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {/* 全体順位（対象外時はテキスト表示） */}
        <div>
          <dt className="text-[11px] text-slate-500">順位</dt>
          <dd className="mt-0.5">
            {overallRank === null ? (
              <span className="text-sm font-bold text-slate-500">対象外</span>
            ) : (
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {overallRank}
                <span className="ml-0.5 text-xs font-normal text-slate-400">
                  位
                </span>
              </span>
            )}
          </dd>
        </div>

        {/* 母集団総人数 */}
        <div>
          <dt className="text-[11px] text-slate-500">総人数</dt>
          <dd className="mt-0.5">
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {totalCount}
              <span className="ml-0.5 text-xs font-normal text-slate-400">
                人
              </span>
            </span>
          </dd>
        </div>

        {/* 自身の GRANレベル（+ 階級ラベル） */}
        <div>
          <dt className="text-[11px] text-slate-500">自身レベル</dt>
          <dd className="mt-0.5">
            <span className="text-lg font-bold tabular-nums text-emerald-700">
              {granLevel}
            </span>
            <span className="ml-1 text-[11px] font-bold text-slate-400">
              {classLabel}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
