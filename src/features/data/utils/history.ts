interface Timed {
  recordedAt: string;
  seq: number;
}

function cmpAsc(a: Timed, b: Timed): number {
  if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
  return a.seq - b.seq;
}

// 日時降順、同一日時は seq 降順（入力は変更しない）
export function sortHistoryDesc<T extends Timed>(rows: T[]): T[] {
  return [...rows].sort((a, b) => cmpAsc(b, a));
}

// グラフ用: 全件を昇順
export function toChartSeries<T extends Timed>(rows: T[]): T[] {
  return [...rows].sort(cmpAsc);
}

export function formatDelta(diff: number): {
  text: string;
  direction: "up" | "down" | "flat";
} {
  if (diff > 0) return { text: `+${diff}`, direction: "up" };
  if (diff < 0) return { text: `\u2212${Math.abs(diff)}`, direction: "down" };
  return { text: "\u00B10", direction: "flat" };
}

interface RecentCandidate {
  eventDate: string;
  createdAt?: string; // 登録日時
  seq?: number; // rowid 等
}

// 開催日降順 → 登録日時降順 → seq 降順で直近 limit 件（既定5）
export function selectRecentMatches<T extends RecentCandidate>(
  matches: T[],
  limit = 5,
): T[] {
  const cmp = (a: T, b: T): number => {
    if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? 1 : -1;
    const ac = a.createdAt ?? "";
    const bc = b.createdAt ?? "";
    if (ac !== bc) return ac < bc ? 1 : -1;
    return (b.seq ?? 0) - (a.seq ?? 0);
  };
  return [...matches].sort(cmp).slice(0, limit);
}
