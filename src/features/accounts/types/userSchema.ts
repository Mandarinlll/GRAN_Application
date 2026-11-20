import { z } from "zod";
import { parseGranLevel } from "../utils/calibration";
import type { CreateUserInput } from "./account";

const NAME_MAX = 40;
const EMAIL_MAX = 255;
const REQUIRED = "必須項目です";

function jstToday(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// 空文字・空白のみ・未指定を null にする（任意項目用）。
const blankToNull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

const requiredText = (max?: number) =>
  z
    .string({ error: REQUIRED })
    .trim()
    .min(1, REQUIRED)
    .refine((s) => max === undefined || [...s].length <= max, `${max}文字以内で入力してください`);

export function createUserSchema(now: Date = new Date()) {
  const today = jstToday(now);
  return z.object({
    email: z
      .string({ error: REQUIRED })
      .trim()
      .min(1, REQUIRED)
      .refine((s) => s.length <= EMAIL_MAX, `${EMAIL_MAX}文字以内で入力してください`)
      .refine((s) => z.email().safeParse(s).success, "メールアドレスの形式が正しくありません")
      .transform((s) => s.toLowerCase()),
    realName: requiredText(NAME_MAX),
    kanaName: requiredText(NAME_MAX),
    nickname: requiredText(NAME_MAX),
    gender: z.preprocess(
      blankToNull,
      z.enum(["MALE", "FEMALE", "OTHER"], { error: "許可されていない値です" }).nullable(),
    ),
    birthDate: z.preprocess(
      blankToNull,
      z
        .string({ error: "無効な日付です" })
        .refine(isRealDate, "無効な日付です")
        .refine((s) => s <= today, "未来の日付は指定できません")
        .nullable(),
    ),
    phoneNumber: z
      .string({ error: REQUIRED })
      .trim()
      .min(1, REQUIRED)
      .regex(/^[0-9-]{10,15}$/, "数字とハイフンのみ、10〜15文字で入力してください"),
    declaredClass: z
      .string({ error: REQUIRED })
      .trim()
      .min(1, REQUIRED)
      .pipe(z.enum(["A", "AB", "B", "BC", "C", "CD", "D", "DE"], { error: "許可されていない値です" })),
    granLevel: z.preprocess(
      blankToNull,
      z
        .unknown()
        .refine((v) => parseGranLevel(v) !== null, "100〜999の整数で入力してください")
        .transform((v) => parseGranLevel(v) as number)
        .nullable(),
    ),
    role: z.preprocess(
      (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? "USER" : v),
      z.enum(["ADMIN", "OPERATOR", "LEADER", "USER"], { error: "許可されていない値です" }),
    ),
  });
}

export type CreateUserParseResult =
  | { ok: true; data: CreateUserInput }
  | { ok: false; fieldErrors: Record<string, string> };

// すべての項目のエラーを同時に集める（項目ごとに最初のメッセージ）。
export function parseCreateUserInput(raw: unknown, now: Date = new Date()): CreateUserParseResult {
  const input = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  const r = createUserSchema(now).safeParse(input);
  if (r.success) return { ok: true, data: r.data as CreateUserInput };
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}
