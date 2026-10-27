// データタブ（GRAN_Data_Tab）の画面内タブ親コンポーネント。
//
// 6 領域（個人ランキング / チームランキング / レベル推移 / 出場履歴 /
// レベル分布 / 成績サマリ）を画面内タブで切り替え、各パネルへ初期データを
// props として振り分ける（Requirement 1.2 / 1.3 / 1.4）。
//
// タブUIの方針:
//   - `role="tablist"` / `role="tab"` によるタブ構造とし、選択中タブに
//     `aria-selected` と `aria-current` を付与する（Requirement 1.3 / 1.7）。
//   - 各タブは幅・高さともに 44px 以上のタッチターゲットとする（Requirement 1.5）。
//   - タブは通常のボタン要素でキーボード操作可能（Tab/Enter/Space）とする。
//   - 画面幅に応じて横スクロール可能なタブバーとし、md 以上でも同一の
//     画面内タブで各領域を切り替える（AppShell 側のサイドバー/ヘッダーは
//     ページ側で提供 / Requirement 1.4）。
//   - 順位・レベル・成績などの重要情報は各パネルが HTML テキストとして描画する
//     （Requirement 1.7）。
//
// 本コンポーネントは Client（タブ選択状態を useState で保持）であり、
// 初期データ（DataViewData）は Server 側の buildDataViewData から props で届く。
//
// _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7_
"use client";

import { useId, useState } from "react";
import {
  Trophy,
  Users,
  LineChart,
  History,
  BarChart3,
  Award,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataViewData } from "@/features/data/server/dataViewData";
import { PersonalRankingPanel } from "@/features/data/components/PersonalRankingPanel";
import { TeamRankingPanel } from "@/features/data/components/TeamRankingPanel";
import { LevelHistoryPanel } from "@/features/data/components/LevelHistoryPanel";
import { EntryHistoryPanel } from "@/features/data/components/EntryHistoryPanel";
import { LevelDistributionPanel } from "@/features/data/components/LevelDistributionPanel";
import { PerformanceSummaryCard } from "@/features/data/components/PerformanceSummaryCard";

type Props = {
  data: DataViewData;
};

// 6 領域のタブ識別子。初期表示は "personal"（個人ランキング）。
type TabId =
  | "personal"
  | "team"
  | "history"
  | "entries"
  | "distribution"
  | "performance";

// タブの表示定義（表示順・ラベル・アイコン）。
const TABS: readonly { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "personal", label: "個人ランキング", icon: Trophy },
  { id: "team", label: "チームランキング", icon: Users },
  { id: "history", label: "レベル推移", icon: LineChart },
  { id: "entries", label: "出場履歴", icon: History },
  { id: "distribution", label: "レベル分布", icon: BarChart3 },
  { id: "performance", label: "成績サマリ", icon: Award },
] as const;

export function DataTabView({ data }: Props) {
  // 初期表示は個人ランキング（Requirement 1.2 の先頭導線）。
  const [activeTab, setActiveTab] = useState<TabId>("personal");

  // tab と tabpanel を aria で関連付けるための ID プレフィックス。
  const baseId = useId();
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-bold text-slate-900">データ</h1>

      {/* 画面内タブバー（6 領域）。横スクロール可・44px 以上のタッチターゲット。 */}
      <div
        role="tablist"
        aria-label="データタブの表示領域"
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              aria-controls={panelId(tab.id)}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap",
                "rounded-full px-4 py-2 text-sm font-bold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* アクティブなタブに対応するパネルのみを描画する。 */}
      <div
        role="tabpanel"
        id={panelId(activeTab)}
        aria-labelledby={tabId(activeTab)}
      >
        {activeTab === "personal" ? (
          <PersonalRankingPanel
            personalRanking={data.personalRanking}
            tierRankings={data.tierRankings}
            selfRankSummary={data.selfRankSummary}
            selfLoginId={data.selfLoginId}
          />
        ) : null}

        {activeTab === "team" ? (
          <TeamRankingPanel teamRanking={data.teamRanking} />
        ) : null}

        {activeTab === "history" ? (
          <LevelHistoryPanel
            levelHistory={data.levelHistory}
            periodLowerBounds={data.periodLowerBounds}
          />
        ) : null}

        {activeTab === "entries" ? (
          <EntryHistoryPanel entryHistory={data.entryHistory} />
        ) : null}

        {activeTab === "distribution" ? (
          <LevelDistributionPanel
            distribution={data.distribution}
            selfRankSummary={data.selfRankSummary}
            uncalibratedCount={data.uncalibratedCount}
          />
        ) : null}

        {activeTab === "performance" ? (
          <PerformanceSummaryCard performanceSummary={data.performanceSummary} />
        ) : null}
      </div>
    </main>
  );
}
