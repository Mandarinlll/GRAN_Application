// ランキング画面本体。
// 選択状態 { mode, tier, category } は親(ここ)の useState に保持し、
// 階級別/種目別を切り替えても破棄しない（要件9.6）。
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type { RankingCategory } from "@/features/data/types/dto";
import { useRemoteResource } from "@/features/data/hooks/useRemoteResource";
import { EmptyState, ErrorPanel, Skeleton } from "@/features/data/components/RegionState";
import { initialSliderTier } from "@/features/data/utils/tier";
import { RankingTable, type PublicRankingRow } from "./RankingTable";
import { TierSlider } from "./TierSlider";

export type RankingMode = "tier" | "category";

export interface RankingSelection {
  mode: RankingMode;
  tier: TournamentTier;
  category: RankingCategory;
}

/** 種目タブの表示順（要件9.1）。 */
export const RANKING_CATEGORY_TABS: ReadonlyArray<{ value: RankingCategory; label: string }> = [
  { value: "MEN", label: "男子" },
  { value: "WOMEN", label: "女子" },
  { value: "MIXED", label: "混合" },
];

const PAGE_SIZE = 50;

interface RankingResponse {
  rows: PublicRankingRow[];
  total: number;
  nextOffset: number | null;
  me: { rank: number; total: number } | null;
}

interface TabButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function TabButton({ selected, onClick, children, className }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "min-h-[44px] rounded-xl px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-500",
        selected
          ? "bg-emerald-600 font-bold text-white dark:bg-emerald-500 dark:text-slate-900"
          : "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

function buildUrl(selection: RankingSelection, offset: number): string {
  const base =
    selection.mode === "tier"
      ? `/api/data/ranking/tier?tier=${selection.tier}`
      : `/api/data/ranking/category?category=${selection.category}`;
  return `${base}&offset=${offset}&limit=${PAGE_SIZE}`;
}

/**
 * 選択中の順位表。選択（mode + tier/category）が変わると key により再マウントされ、
 * 蓄積行とオフセットがリセットされる。
 */
function RankingList({ selection }: { selection: RankingSelection }) {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<PublicRankingRow[]>([]);
  const [meta, setMeta] = useState<Pick<RankingResponse, "total" | "me"> | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  const { status, data, consecutiveFailures, retry } = useRemoteResource<RankingResponse>({
    url: buildUrl(selection, offset),
    keepStaleOnError: true,
  });

  // 取得成功ごとに行を末尾へ蓄積する。失敗時は何もしないので直前の順位表が残る（要件8.11, 9.10）。
  useEffect(() => {
    if (status !== "success" || !data) return;
    setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
    setMeta({ total: data.total, me: data.me });
    setNextOffset(data.nextOffset);
  }, [status, data, offset]);

  const isTier = selection.mode === "tier";
  const hasRows = rows.length > 0;
  const loaded = meta !== null;

  if (!loaded && status === "error") {
    return <ErrorPanel onRetry={retry} consecutiveFailures={consecutiveFailures} />;
  }
  if (!loaded) {
    return <Skeleton label="順位表を読み込み中" lines={5} />;
  }

  if (meta.total === 0 && !hasRows) {
    return (
      <EmptyState
        message={
          isTier
            ? "この階級に表示できるユーザーがいません。"
            : "この種目に表示できるユーザーがいません。"
        }
      />
    );
  }

  const caption = isTier ? `${selection.tier}級のランキング` : "種目別ランキング";

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-900 dark:text-slate-100" aria-live="polite">
        {meta.me ? (
          <>
            あなたの順位:{" "}
            <span className="font-bold">
              {meta.me.rank}位 / {meta.me.total}人
            </span>
          </>
        ) : (
          <>総人数: {meta.total}人</>
        )}
      </p>

      <RankingTable rows={rows} showTier={!isTier} caption={caption} />

      {status === "error" && (
        <ErrorPanel
          message="順位表の取得に失敗しました。表示中の順位表は直前の内容です。"
          onRetry={retry}
          consecutiveFailures={consecutiveFailures}
        />
      )}

      {status === "loading" && <Skeleton label="順位表を読み込み中" lines={2} />}

      {status === "success" && nextOffset !== null && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setOffset(nextOffset)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-500"
          >
            もっと見る
          </button>
        </div>
      )}
    </div>
  );
}

export function RankingView({ initialTier }: { initialTier: TournamentTier | null }) {
  const [selection, setSelection] = useState<RankingSelection>({
    mode: "tier",
    tier: initialSliderTier(initialTier),
    category: "MEN",
  });

  const listKey =
    selection.mode === "tier" ? `tier:${selection.tier}` : `category:${selection.category}`;

  return (
    <section aria-label="ランキング" className="space-y-4">
      {/* 階級別 / 種目別の切替は上部1か所のみ（要件9.5） */}
      <div role="tablist" aria-label="ランキングの種類" className="grid grid-cols-2 gap-2">
        <TabButton
          selected={selection.mode === "tier"}
          onClick={() => setSelection((s) => ({ ...s, mode: "tier" }))}
        >
          階級別
        </TabButton>
        <TabButton
          selected={selection.mode === "category"}
          onClick={() => setSelection((s) => ({ ...s, mode: "category" }))}
        >
          種目別
        </TabButton>
      </div>

      {selection.mode === "tier" ? (
        <TierSlider
          tier={selection.tier}
          onChange={(tier) => setSelection((s) => ({ ...s, tier }))}
        />
      ) : (
        <div role="tablist" aria-label="種目" className="grid grid-cols-3 gap-2">
          {RANKING_CATEGORY_TABS.map((c) => (
            <TabButton
              key={c.value}
              selected={selection.category === c.value}
              onClick={() => setSelection((s) => ({ ...s, category: c.value }))}
            >
              {c.label}
            </TabButton>
          ))}
        </div>
      )}

      <RankingList key={listKey} selection={selection} />
    </section>
  );
}
