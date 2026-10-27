// 出場履歴のソート・フィルタ（純粋関数・データタブ GRAN_Data_Tab）。
//
// 出場履歴（EntryHistoryRow）の一覧に対し、ソートとフィルタを行う純粋関数を提供する。
//
// ソート（Requirement 6.4 / 6.5）:
//   - ソートキー: 開催日（eventDate） / 種目区分（category） / 成績区分（rankType）
//   - ソート方向: 昇順（asc） / 降順（desc）
//   - 安定性: ソートキーが等しい行は常に「開催日の降順」で安定的に並べる。
//     開催日もさらに等しい場合は、入力配列の元の順序を保持する（安定ソート）。
//   - 初期表示（Requirement 6.4）は eventDate 降順。これは
//     sortEntries(rows, "eventDate", "desc") と等価である。
//
// フィルタ（Requirement 6.6）:
//   - 種目区分（category） / 階級（tier）で絞り込む。
//   - 条件を指定しない項目は絞り込まない（undefined は「全件」を意味する）。
//   - 適用後の全行は指定条件に一致する（Property 9）。
//
// いずれの関数も入力配列を変更せず、新しい配列を返す純粋関数である。
//
// _Requirements: 6.4, 6.5, 6.6_ / _Properties: 9_

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

// 2 行をソートキー単体で比較する（方向適用前の昇順ベース比較）。
// 戻り値が 0 の場合は「ソートキー同値」を意味する。
function compareByKey(
  a: EntryHistoryRow,
  b: EntryHistoryRow,
  key: EntrySortKey,
): number {
  switch (key) {
    case "eventDate":
      // YYYY-MM-DD の固定長文字列は辞書順比較が日付順と一致する。
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

/**
 * 出場履歴を指定キー・方向で並べ替える。
 *
 * - 主キー: `key` を `direction`（asc/desc）で比較する。
 * - タイブレーク: 主キーが等しい行は常に eventDate 降順で並べる
 *   （direction に関係なく降順。Requirement 6.5）。
 * - 最終タイブレーク: eventDate も等しい場合は入力配列の元の順序を保持する
 *   （index を併用した安定ソート）。
 *
 * 入力配列は変更せず、新しい配列を返す。
 */
export function sortEntries(
  rows: EntryHistoryRow[],
  key: EntrySortKey,
  direction: SortDirection,
): EntryHistoryRow[] {
  const directionFactor = direction === "asc" ? 1 : -1;

  // 元の順序を保持するため index を添えてから安定的に比較する。
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      // 1) 主キー比較（方向を適用）。
      const primary = compareByKey(x.row, y.row, key) * directionFactor;
      if (primary !== 0) return primary;

      // 2) 主キー同値のタイブレーク: eventDate 降順（方向非依存）。
      //    key が eventDate の場合は既に同値（= eventDate が等しい）なので
      //    この比較は 0 となり、次の index 比較へ進む。
      const byDate = compareEventDateDesc(x.row, y.row);
      if (byDate !== 0) return byDate;

      // 3) 元の順序を保持（安定）。
      return x.index - y.index;
    })
    .map((entry) => entry.row);
}

/**
 * 出場履歴を種目区分 / 階級で絞り込む。
 *
 * - `category` が指定された場合、`row.category === category` の行のみを残す。
 * - `tier` が指定された場合、`row.tier === tier` の行のみを残す。
 * - 未指定の条件では絞り込まない（AND 条件）。
 *
 * 入力配列は変更せず、新しい配列を返す。
 */
export function filterEntries(
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
