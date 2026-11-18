// 1 ページ 20 件のページング（純粋関数）。ページ番号は 1 始まり。
// data/utils/pagination.ts の slicePage は offset/limit 形式で用途が異なるため、別に定義する。

export const PAGE_SIZE = 20;

export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  if (total <= 0 || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

// 不正なページ番号（NaN・0 以下・小数）を 1 に、範囲外を最終ページに丸める。
export function clampPage(
  page: number,
  total: number,
  pageSize: number = PAGE_SIZE,
): number {
  const p = Number.isFinite(page) ? Math.floor(page) : 1;
  const last = Math.max(1, totalPages(total, pageSize));
  return Math.min(Math.max(1, p), last);
}

export function pageOffset(page: number, pageSize: number = PAGE_SIZE): number {
  return (Math.max(1, Math.floor(page)) - 1) * pageSize;
}

export function paginate<T>(
  rows: T[],
  page: number,
  pageSize: number = PAGE_SIZE,
): { items: T[]; page: number; totalPages: number; total: number } {
  const current = clampPage(page, rows.length, pageSize);
  const start = pageOffset(current, pageSize);
  return {
    items: rows.slice(start, start + pageSize),
    page: current,
    totalPages: totalPages(rows.length, pageSize),
    total: rows.length,
  };
}
