import type { AccountStatus, DeclaredClass, UserRole } from "@/types/user";

export const PAGE_SIZE = 50;
export const MAX_SEARCH_LENGTH = 100;

const ROLES: readonly UserRole[] = ["ADMIN", "OPERATOR", "LEADER", "USER"];
const STATUSES: readonly AccountStatus[] = ["ACTIVE", "SUSPENDED", "PROVISIONAL"];
const CLASSES: readonly DeclaredClass[] = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];

export type SearchParams = Record<string, string | string[] | undefined>;

export interface UserListQuery {
  q?: string;
  role?: UserRole;
  status?: AccountStatus;
  declaredClass?: DeclaredClass;
  lockedOnly: boolean;
  uncalibratedOnly: boolean;
  page: number;
}

export interface TeamListQuery {
  q?: string;
  page: number;
}

export type ParseResult<Q> = { ok: true; query: Q } | { ok: false; error: string };

const SEARCH_TOO_LONG = `検索語は${MAX_SEARCH_LENGTH}文字以内で入力してください`;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function pick<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function parsePage(v: string | undefined): number {
  if (v === undefined || !/^\d+$/.test(v.trim())) return 1;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

// trim 後の検索語。空は未指定。100 文字超は null（エラー）。
function parseSearch(v: string | undefined): { ok: true; q?: string } | { ok: false } {
  const q = v?.trim() ?? "";
  if (q.length === 0) return { ok: true };
  if ([...q].length > MAX_SEARCH_LENGTH) return { ok: false };
  return { ok: true, q };
}

export function parseUserListQuery(sp: SearchParams): ParseResult<UserListQuery> {
  const s = parseSearch(first(sp.q));
  if (!s.ok) return { ok: false, error: SEARCH_TOO_LONG };
  return {
    ok: true,
    query: {
      q: s.q,
      role: pick(first(sp.role), ROLES),
      status: pick(first(sp.status), STATUSES),
      declaredClass: pick(first(sp.declaredClass), CLASSES),
      lockedOnly: first(sp.locked) === "1",
      uncalibratedOnly: first(sp.uncalibrated) === "1",
      page: parsePage(first(sp.page)),
    },
  };
}

export function parseTeamListQuery(sp: SearchParams): ParseResult<TeamListQuery> {
  const s = parseSearch(first(sp.q));
  if (!s.ok) return { ok: false, error: SEARCH_TOO_LONG };
  return { ok: true, query: { q: s.q, page: parsePage(first(sp.page)) } };
}

// 表示範囲（1 始まり）。total が 0 のときは from = to = 0。page は最終ページに丸めない（呼び出し側で丸める）。
export function pageRange(total: number, page: number): { from: number; to: number; pages: number } {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= 0) return { from: 0, to: 0, pages };
  const p = Math.min(Math.max(1, Math.floor(page)), pages);
  const from = (p - 1) * PAGE_SIZE + 1;
  return { from, to: Math.min(p * PAGE_SIZE, total), pages };
}
