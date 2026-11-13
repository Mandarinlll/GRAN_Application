// データタブ API のクエリ検証スキーマ（zod）と既定値。

import { z } from "zod";

export const HISTORY_DEFAULT_LIMIT = 20;
export const HISTORY_MAX_LIMIT = 50;
export const PARTICIPATION_DEFAULT_LIMIT = 20;
export const PARTICIPATION_MAX_LIMIT = 50;
export const RANKING_DEFAULT_LIMIT = 50;
export const RANKING_MAX_LIMIT = 50;

export const DIMENSIONS = [
  "category",
  "venue",
  "surface",
  "season",
  "opponent",
  "series",
] as const;
export const TIERS = ["DE", "D", "CD", "C", "BC", "B", "AB", "A"] as const;
export const RANKING_CATEGORIES = ["MEN", "WOMEN", "MIXED"] as const;

// 文字列の非負整数 → number。未指定は既定値。範囲外・非数値は検証エラー。
const intParam = (min: number, max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional()
    .transform((v) => v ?? fallback);

const offsetParam = intParam(0, 1_000_000, 0);
const limitParam = (def: number, max: number) => intParam(1, max, def);

export const historyQuerySchema = z.object({
  offset: offsetParam,
  limit: limitParam(HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT),
});

export const winRateQuerySchema = z.object({
  dimension: z.enum(DIMENSIONS),
});

export const participationsQuerySchema = z.object({
  division: z.enum(["MEN", "WOMEN", "MIXED"]).optional(),
  tier: z.enum(TIERS).optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .transform(Number)
    .optional(),
  order: z.enum(["asc", "desc"]).optional().transform((v) => v ?? "desc"),
  offset: offsetParam,
  limit: limitParam(PARTICIPATION_DEFAULT_LIMIT, PARTICIPATION_MAX_LIMIT),
});

export const tierRankingQuerySchema = z.object({
  tier: z.enum(TIERS),
  offset: offsetParam,
  limit: limitParam(RANKING_DEFAULT_LIMIT, RANKING_MAX_LIMIT),
});

export const categoryRankingQuerySchema = z.object({
  category: z.enum(RANKING_CATEGORIES),
  offset: offsetParam,
  limit: limitParam(RANKING_DEFAULT_LIMIT, RANKING_MAX_LIMIT),
});

export const tournamentIdParamsSchema = z.object({
  tournamentId: z.string().min(1),
});
