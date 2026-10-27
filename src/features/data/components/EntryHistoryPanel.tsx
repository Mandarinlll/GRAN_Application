// 出場履歴パネル（Entry_History_View・Client）。
//
// 閲覧ユーザー自身の過去の大会出場一覧を表示する（Requirement 6）。
//   - ソート: 開催日 / 種目区分 / 成績区分（昇順・降順）。初期は開催日降順（6.4 / 6.5）。
//   - フィルタ: 種目区分 / 階級（6.6）。
//   - gran_level_diff 未記録（null）はプレースホルダー「—（未記録）」を表示し、
//     当該行の他項目は引き続き表示する（6.3）。
//   - 空状態: 履歴 0 件は「履歴未記録」の空状態（6.8）、
//     フィルタ結果 0 件は「条件一致なし」のメッセージ（6.7）。
//   - 取得失敗時は ErrorRetry（エラー表示 + 再取得）（6.9）。
//
// 重要情報は HTML テキスト化し、操作可能なコントロールは 44px 以上のタッチ
// ターゲット + aria を付与する（Requirement 1.5 / 1.7）。ソート・フィルタは
// entryHistory.ts の純粋関数（sortEntries / filterEntries）を用いる。
//
// _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8, 6.9_
"use client";

import { useMemo, useState } from "react";
import type { EntryHistoryRow } from "@/features/data/types/data";
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  type TournamentCategory,
  type TournamentTier,
} from "@/features/tournaments/types/tournament";
import {
  filterEntries,
  sortEntries,
  type EntryFilter,
  type EntrySortKey,
  type SortDirection,
} from "@/features/data/utils/entryHistory";
import { EmptyState } from "./EmptyState";
import { ErrorRetry } from "./ErrorRetry";
import { cn } from "@/lib/utils";

type Props = {
  // 出場履歴の一覧（DataViewData 由来の公開フィールドのみ）。
  entryHistory: EntryHistoryRow[];
  // 取得失敗フラグ。true のとき ErrorRetry を表示する（6.9）。
  error?: boolean;
  // 再取得ボタン押下時のコールバック（ErrorRetry へ委譲）。
  onRetry?: () => void;
};

// 成績区分 → 日本語表示名。
const RANK_TYPE_LABEL: Record<EntryHistoryRow["rankType"], string> = {
  PARTICIPATED: "出場",
  L2_WINNER: "2部優勝",
  T1_RUNNER_UP: "準優勝",
  T1_WINNER: "優勝",
};

// ソートキー選択肢（開催日 / 種目区分 / 成績区分）。
const SORT_KEY_OPTIONS: { value: EntrySortKey; label: string }[] = [
  { value: "eventDate", label: "開催日" },
  { value: "category", label: "種目" },
  { value: "rankType", label: "成績" },
];

// 共通の 44px タッチターゲット + フォーカスリングのクラス。
const CONTROL_CLASS = cn(
  "min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700",
  "transition-colors focus-visible:outline-none focus-visible:ring-2",
  "focus-visible:ring-brand-500 focus-visible:ring-offset-1",
);

// gran_level_diff を符号付きテキストへ整形する（正は + を付与）。
function formatDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function EntryHistoryPanel({ entryHistory, error, onRetry }: Props) {
  const [sortKey, setSortKey] = useState<EntrySortKey>("eventDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [categoryFilter, setCategoryFilter] = useState<TournamentCategory | "">(
    "",
  );
  const [tierFilter, setTierFilter] = useState<TournamentTier | "">("");

  // フィルタ → ソートの順で純粋関数を適用する。
  const visibleRows = useMemo(() => {
    const filter: EntryFilter = {};
    if (categoryFilter !== "") filter.category = categoryFilter;
    if (tierFilter !== "") filter.tier = tierFilter;

    const filtered = filterEntries(entryHistory, filter);
    return sortEntries(filtered, sortKey, sortDirection);
  }, [entryHistory, categoryFilter, tierFilter, sortKey, sortDirection]);

  // 取得失敗時はエラー表示 + 再取得のみを提示する（6.9）。
  if (error) {
    return (
      <ErrorRetry
        message="出場履歴の取得に失敗しました。"
        onRetry={onRetry}
      />
    );
  }

  // 履歴そのものが 0 件（未記録）の空状態（6.8）。
  if (entryHistory.length === 0) {
    return (
      <EmptyState
        message="出場履歴が未記録です"
        description="大会に出場すると、ここに履歴が表示されます。"
      />
    );
  }

  const hasActiveFilter = categoryFilter !== "" || tierFilter !== "";

  return (
    <section aria-label="出場履歴" className="flex flex-col gap-4">
      {/* ソート・フィルタコントロール */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {/* ソート */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="entry-sort-key"
            className="text-xs font-bold text-slate-500"
          >
            並び替え
          </label>
          <select
            id="entry-sort-key"
            aria-label="ソート基準"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as EntrySortKey)}
            className={CONTROL_CLASS}
          >
            {SORT_KEY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={
              sortDirection === "asc"
                ? "昇順。押すと降順に切り替え"
                : "降順。押すと昇順に切り替え"
            }
            aria-pressed={sortDirection === "asc"}
            onClick={() =>
              setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
            }
            className={cn(CONTROL_CLASS, "min-w-[44px]")}
          >
            {sortDirection === "asc" ? "昇順 ↑" : "降順 ↓"}
          </button>
        </div>

        {/* フィルタ */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="entry-filter-category"
            className="text-xs font-bold text-slate-500"
          >
            絞り込み
          </label>
          <select
            id="entry-filter-category"
            aria-label="種目区分で絞り込み"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as TournamentCategory | "")
            }
            className={CONTROL_CLASS}
          >
            <option value="">種目: すべて</option>
            {(Object.keys(CATEGORY_LABEL) as TournamentCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            id="entry-filter-tier"
            aria-label="階級で絞り込み"
            value={tierFilter}
            onChange={(e) =>
              setTierFilter(e.target.value as TournamentTier | "")
            }
            className={CONTROL_CLASS}
          >
            <option value="">階級: すべて</option>
            {(Object.keys(TIER_LABEL) as TournamentTier[]).map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 一覧（フィルタ結果 0 件は条件一致なしメッセージ） */}
      {visibleRows.length === 0 ? (
        <EmptyState
          message="条件に一致する履歴がありません"
          description="絞り込み条件を変更してください。"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleRows.map((row, index) => (
            <li
              key={`${row.tournamentTitle}-${row.eventDate}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">
                  {row.tournamentTitle}
                </p>
                <span className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                  {RANK_TYPE_LABEL[row.rankType]}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
                <div className="flex flex-col">
                  <dt className="text-[11px] font-bold text-slate-400">
                    開催日
                  </dt>
                  <dd>{row.eventDate}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-[11px] font-bold text-slate-400">
                    種目区分
                  </dt>
                  <dd>{CATEGORY_LABEL[row.category]}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-[11px] font-bold text-slate-400">
                    階級
                  </dt>
                  <dd>{TIER_LABEL[row.tier]}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-[11px] font-bold text-slate-400">
                    レベル変動
                  </dt>
                  <dd>
                    {row.granLevelDiff === null ? (
                      <span className="text-slate-400" aria-label="未記録">
                        —（未記録）
                      </span>
                    ) : (
                      formatDiff(row.granLevelDiff)
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {/* 件数の補足（アクティブなフィルタ時のみ） */}
      {hasActiveFilter && visibleRows.length > 0 ? (
        <p className="text-xs text-slate-400">
          {entryHistory.length} 件中 {visibleRows.length} 件を表示
        </p>
      ) : null}
    </section>
  );
}
