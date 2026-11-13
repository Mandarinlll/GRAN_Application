// 大会の登録・更新入力の検証スキーマ（zod）。
// 個人戦（SINGLES / DOUBLES）は種目の部門（gender_division）を必須とする。
// 団体戦は category から部門が確定するため gender_division は任意。

import { z } from "zod";

export const TOURNAMENT_CATEGORIES = [
  "MEN_TEAM",
  "WOMEN_TEAM",
  "MIX_TEAM",
  "SINGLES",
  "DOUBLES",
] as const;

export const genderDivisionSchema = z.enum(["MEN", "WOMEN", "MIXED"]);

export const surfaceSchema = z.enum(["HARD", "CLAY", "ARTIFICIAL_GRASS", "OTHER"]);

const GENDER_DIVISION_REQUIRED_MESSAGE =
  "シングルス・ダブルスでは種目（男子・女子・混合）の指定が必要です";

// category と genderDivision の組み合わせを検証する共通ルール。
export function requireGenderDivisionForIndividual(
  value: { category?: string; genderDivision?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (
    (value.category === "SINGLES" || value.category === "DOUBLES") &&
    !value.genderDivision
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["genderDivision"],
      message: GENDER_DIVISION_REQUIRED_MESSAGE,
    });
  }
}

// 登録用: category が必須。
export const tournamentCreateSchema = z
  .object({
    category: z.enum(TOURNAMENT_CATEGORIES),
    genderDivision: genderDivisionSchema.nullish(),
    // サーフェスは必須（未指定・null は拒否。path: ["surface"]）
    surface: surfaceSchema,
  })
  .passthrough()
  .superRefine(requireGenderDivisionForIndividual);

// 更新用: category を変更しない場合は既存値を existingCategory として渡して検証する。
export const tournamentUpdateSchema = z
  .object({
    category: z.enum(TOURNAMENT_CATEGORIES).optional(),
    genderDivision: genderDivisionSchema.nullish(),
    surface: surfaceSchema.nullish(),
  })
  .passthrough();

// 更新時、最終的な category / genderDivision（入力が無ければ既存値）で検証する。
export function validateTournamentUpdate(
  input: unknown,
  existing: {
    category: string;
    genderDivision: string | null;
    surface: string | null;
  },
): z.ZodSafeParseResult<unknown> {
  const parsed = tournamentUpdateSchema.safeParse(input);
  if (!parsed.success) return parsed;
  const merged = {
    ...parsed.data,
    category: parsed.data.category ?? existing.category,
    genderDivision:
      parsed.data.genderDivision === undefined
        ? existing.genderDivision
        : parsed.data.genderDivision,
    surface:
      parsed.data.surface === undefined ? existing.surface : parsed.data.surface,
  };
  return tournamentCreateSchema.safeParse(merged);
}
