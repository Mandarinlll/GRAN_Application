// 出場履歴のソート・フィルタのドメインサービス（oop-architecture.md §2.3 / §5）。
//
// 現行 data/utils/entryHistory.ts の sortEntries / filterEntries を 1:1 で移植した。
// ソート: 主キー（eventDate/category/rankType）× 方向（asc/desc）、主キー同値は eventDate 降順、
// さらに同値は入力順保持（安定ソート）。フィルタ: category / tier の AND 条件。
// いずれも入力配列を変更せず新しい配列を返す純粋ロジックとする。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { EntryHistoryRow, ResultRank } from "@/features/data/types/data";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// ソート可能なキー。
export type EntrySortKey = "eventDate" | "category" | "rankType";

// ソート方向。
export type SortDirection = "asc" | "desc";

// フィルタ条件。いずれも省略可能（未指定 = 絞り込まない）。
export interface EntryFilter {
  category?: TournamentCategory;
  tier?: TournamentTier;
}

// 種目区分の並び順（enum 宣言順）。category ソートの序数に用いる。
const CATEGORY_ORDER: Record<TournamentCategory, number> = {
  MEN_TEAM: 0,
  WOMEN_TEAM: 1,
  MIX_TEAM: 2,
  SINGLES: 3,
  DOUBLES: 4,
};

// 成績区分の並び順（成績の進行度の低い順）。rankType ソートの序数に用いる。
//   PARTICIPATED < L2_WINNER < T1_RUNNER_UP < T1_WINNER
const RANK_TYPE_ORDER: Record<ResultRank, number> = {
  PARTICIPATED: 0,
  L2_WINNER: 1,
  T1_RUNNER_UP: 2,
  T1_WINNER: 3,
};

// 2 行をソートキー単体で比較する（方向適用前の昇順ベース比較）。0 は「ソートキー同値」。
function compareByKey(
  a: EntryHistoryRow,
  b: EntryHistoryRow,
  key: EntrySortKey,
): number {
  switch (key) {
    case "eventDate":
      if (a.eventDate === b.eventDate) return 0;
      return a.eventDate < b.eventDate ? -1 : 1;
    case "category": {
      const diff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
      return diff === 0 ? 0 : diff < 0 ? -1 : 1;
    }
    case "rankType": {
      const diff = RANK_TYPE_ORDER[a.rankType] - RANK_TYPE_ORDER[b.rankType];
      return diff === 0 ? 0 : diff < 0 ? -1 : 1;
    }
    default:
      return 0;
  }
}

// eventDate の降順比較（タイブレーク用）。等しい場合は 0。
function compareEventDateDesc(a: EntryHistoryRow, b: EntryHistoryRow): number {
  if (a.eventDate === b.eventDate) return 0;
  return a.eventDate > b.eventDate ? -1 : 1;
}

export class EntryHistoryService {
  // 出場履歴を指定キー・方向で並べ替える（主キー同値は eventDate 降順、さらに同値は入力順保持）。
  sortEntries(
    rows: EntryHistoryRow[],
    key: EntrySortKey,
    direction: SortDirection,
  ): EntryHistoryRow[] {
    const directionFactor = direction === "asc" ? 1 : -1;

    return rows
      .map((row, index) => ({ row, index }))
      .sort((x, y) => {
        const primary = compareByKey(x.row, y.row, key) * directionFactor;
        if (primary !== 0) return primary;

        const byDate = compareEventDateDesc(x.row, y.row);
        if (byDate !== 0) return byDate;

        return x.index - y.index;
      })
      .map((entry) => entry.row);
  }

  // 出場履歴を種目区分 / 階級で絞り込む（AND 条件・未指定は絞り込まない）。
  filterEntries(
    rows: EntryHistoryRow[],
    filter: EntryFilter = {},
  ): EntryHistoryRow[] {
    const { category, tier } = filter;

    return rows.filter((row) => {
      if (category !== undefined && row.category !== category) return false;
      if (tier !== undefined && row.tier !== tier) return false;
      return true;
    });
  }
}
