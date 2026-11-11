export function slicePage<T>(
  rows: T[],
  offset: number,
  limit: number,
): { items: T[]; total: number; nextOffset: number | null } {
  const total = rows.length;
  const start = Math.max(0, Math.floor(offset));
  const size = Math.max(0, Math.floor(limit));
  const items = rows.slice(start, start + size);
  const end = start + items.length;
  return { items, total, nextOffset: end < total && size > 0 ? end : null };
}
