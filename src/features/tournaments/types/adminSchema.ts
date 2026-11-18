// 管理者用の大会入力検証（Zod）。登録・更新・コピー・一括登録で共通に使う。
// - 必須・列挙・範囲・文字数・クロスフィールド検証を行い、全項目のエラーを同時に返す。
// - 日時は "YYYY-MM-DD HH:mm:00"、時刻は "HH:mm" に正規化する。
// - 空文字・空白のみの任意項目は null にする。
// - 団体戦で genderDivision 未指定なら category から補完する。

import { z } from "zod";
import type { TournamentInput } from "./adminTournament";
import { surfaceSchema, genderDivisionSchema, TOURNAMENT_CATEGORIES } from "./schema";

export const MAX_TITLE_LENGTH = 100;
export const MAX_PRIZE_LENGTH = 200;
export const MAX_CAPACITY = 9999;
export const MAX_ENTRY_FEE = 999999;
export const MAX_BULK_ROWS = 50;

const TIERS = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"] as const;

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// "" / 空白のみ / 未指定 → null
const emptyToNull = (v: unknown) => (isBlank(v) ? null : v);

// ---- 日付・時刻の部品 ----

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// 翌日の "YYYY-MM-DD"（UTC 演算）。不正な日付は null。
export function nextDay(date: string): string | null {
  if (!isRealDate(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const requiredText = (label: string, max?: number) => {
  let s = z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`);
  if (max !== undefined) s = s.max(max, `${label}は${max}文字以内にしてください`);
  return s;
};

const optionalText = (label: string, max?: number) => {
  let s = z.string({ error: `${label}の形式が正しくありません` }).trim();
  if (max !== undefined) s = s.max(max, `${label}は${max}文字以内にしてください`);
  return z.preprocess(emptyToNull, s.nullable());
};

const dateField = (label: string) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .refine(isRealDate, `${label}は実在する日付（YYYY-MM-DD）で入力してください`);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const normalizeTime = (s: string) => s.slice(0, 5);
const timeMessage = (label: string) => `${label}は HH:mm 形式で入力してください`;

const requiredTime = (label: string) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .regex(TIME_RE, timeMessage(label))
    .transform(normalizeTime);

const optionalTime = (label: string) =>
  z.preprocess(
    emptyToNull,
    z
      .string({ error: timeMessage(label) })
      .trim()
      .regex(TIME_RE, timeMessage(label))
      .transform(normalizeTime)
      .nullable(),
  );

const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const requiredDateTime = (label: string) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .refine((s) => {
      const m = DATETIME_RE.exec(s);
      return !!m && isRealDate(m[1]);
    }, `${label}は日時（YYYY-MM-DD HH:mm）で入力してください`)
    .transform((s) => {
      const m = DATETIME_RE.exec(s);
      return m ? `${m[1]} ${m[2]}:${m[3]}:00` : s;
    });

// ---- 数値の部品 ----

function toNumberInput(v: unknown): unknown {
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return undefined;
    return /^-?\d+$/.test(t) ? Number(t) : v;
  }
  return v;
}

const intMessage = (label: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? `${label}を入力してください` : `${label}は整数で入力してください`;

const requiredInt = (label: string, min: number, max: number) =>
  z.preprocess(
    toNumberInput,
    z
      .number({ error: intMessage(label) })
      .int(`${label}は整数で入力してください`)
      .min(min, `${label}は${min}以上で入力してください`)
      .max(max, `${label}は${max}以下で入力してください`),
  );

const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (isBlank(v) ? null : toNumberInput(v)),
    z
      .number({ error: `${label}は整数で入力してください` })
      .int(`${label}は整数で入力してください`)
      .min(min, `${label}は${min}以上で入力してください`)
      .max(max, `${label}は${max}以下で入力してください`)
      .nullable(),
  );

const optionalEnum = <T extends z.ZodEnum>(schema: T) => z.preprocess(emptyToNull, schema.nullable());

// ---- 本体 ----

// 大会入力の項目定義（更新・コピー・一括の各スキーマで再利用する）。
export const tournamentShape = {
  title: requiredText("大会名", MAX_TITLE_LENGTH),
  eventDate: dateField("開催日"),
  category: z.enum(TOURNAMENT_CATEGORIES, { error: "種目区分を選択してください" }),
  tier: z.enum(TIERS, { error: "募集階級を選択してください" }),
  venue: requiredText("会場"),
  capacity: requiredInt("定員", 1, MAX_CAPACITY),
  entryFee: requiredInt("参加費", 0, MAX_ENTRY_FEE),
  startTime: requiredTime("開始時刻"),
  entryStartAt: requiredDateTime("受付開始"),
  entryEndAt: requiredDateTime("受付締切"),
  description: optionalText("大会説明"),
  endTime: optionalTime("終了時刻"),
  prize: optionalText("景品", MAX_PRIZE_LENGTH),
  courtInfo: optionalText("コート情報"),
  teamSizeMin: optionalInt("チーム最低人数", 1, MAX_CAPACITY),
  teamSizeMax: optionalInt("チーム最大人数", 1, MAX_CAPACITY),
  alertThreshold: optionalInt("アラート閾値", 0, MAX_CAPACITY),
  surface: optionalEnum(surfaceSchema),
  seriesId: optionalText("シリーズID"),
  genderDivision: optionalEnum(genderDivisionSchema),
};

type CrossValue = Partial<Record<keyof typeof tournamentShape, unknown>>;

// クロスフィールド検証。前提となる項目が不正（型が違う）な場合はその組み合わせの検証を省く。
function crossCheck(v: CrossValue, ctx: z.RefinementCtx): void {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  const str = (x: unknown): x is string => typeof x === "string";
  const num = (x: unknown): x is number => typeof x === "number";

  if (str(v.startTime) && str(v.endTime) && v.endTime <= v.startTime) {
    add("endTime", "終了時刻は開始時刻より後にしてください");
  }
  if (str(v.entryStartAt) && str(v.entryEndAt) && v.entryEndAt <= v.entryStartAt) {
    add("entryEndAt", "受付締切は受付開始より後にしてください");
  }
  if (str(v.eventDate) && str(v.entryEndAt)) {
    const next = nextDay(v.eventDate);
    if (next && v.entryEndAt >= `${next} 00:00:00`) {
      add("entryEndAt", "受付締切は開催日の翌日 0 時より前にしてください");
    }
  }
  if (num(v.teamSizeMin) && num(v.teamSizeMax) && v.teamSizeMin > v.teamSizeMax) {
    add("teamSizeMax", "チーム最大人数はチーム最低人数以上にしてください");
  }
  if (num(v.alertThreshold) && num(v.capacity) && v.alertThreshold > v.capacity) {
    add("alertThreshold", "アラート閾値は定員以下にしてください");
  }
}

const TEAM_GENDER: Record<string, "MEN" | "WOMEN" | "MIXED"> = {
  MEN_TEAM: "MEN",
  WOMEN_TEAM: "WOMEN",
  MIX_TEAM: "MIXED",
};

// 団体戦で genderDivision が未指定なら category から補完する。
function fillGenderDivision<T extends { category: string; genderDivision: string | null }>(v: T): T {
  if (v.genderDivision == null && TEAM_GENDER[v.category]) {
    return { ...v, genderDivision: TEAM_GENDER[v.category] };
  }
  return v;
}

// 先行項目が失敗してもクロスフィールド検証を実行する（全項目エラーの同時返却）。
function alwaysRun<C extends { _zod: { def: { when?: unknown } } }>(check: C): C {
  check._zod.def.when = () => true;
  return check;
}

// 管理者用スキーマの共通ビルド。shape に追加項目を足した上で検証・補完を適用する。
function build<E extends z.ZodRawShape>(extra: E) {
  return z
    .object({ ...tournamentShape, ...extra })
    .check(alwaysRun(z.superRefine((v, ctx) => crossCheck(v as CrossValue, ctx))))
    .transform((v) => fillGenderDivision(v as { category: string; genderDivision: string | null } & typeof v));
}

// 基本（登録の保存用入力）。
export const adminTournamentSchema = build({});

// 登録用（コピー元 ID は任意）。
export const adminCreateSchema = build({
  copyFromId: z.preprocess(emptyToNull, z.string().trim().nullable()),
});

// 更新用（楽観ロック用 expectedUpdatedAt が必須）。
export const adminUpdateSchema = build({
  expectedUpdatedAt: z
    .string({ error: "更新日時が指定されていません" })
    .trim()
    .min(1, "更新日時が指定されていません"),
});

// ---- 一括登録 ----

// 一括登録は、common と各行を結合して adminTournamentSchema で検証する。
// common 由来の項目エラーは common.<項目> に 1 度だけ、行由来は rows.<行番号 0 始まり>.<項目> に付ける。
// common: 開催日と種目区分以外の項目、rows: { eventDate, category, title? } の 1〜50 件。
const ROW_OWN_FIELDS = new Set(["eventDate", "category", "title"]);

export const adminBulkSchema = z
  .object({
    common: z.record(z.string(), z.unknown()),
    rows: z.array(z.record(z.string(), z.unknown())).min(1, "登録する行を 1 件以上指定してください").max(MAX_BULK_ROWS, `一括登録は ${MAX_BULK_ROWS} 件までです`),
  })
  .check(
    z.superRefine((v, ctx) => {
      const seen = new Set<string>();
      v.rows.forEach((row, i) => {
        const merged = { ...v.common, ...row };
        if (isBlank(row.title)) merged.title = v.common.title;
        const r = adminTournamentSchema.safeParse(merged);
        if (r.success) return;
        for (const issue of r.error.issues) {
          const field = String(issue.path[0] ?? "form");
          if (ROW_OWN_FIELDS.has(field)) {
            ctx.addIssue({ code: "custom", path: ["rows", i, field], message: issue.message });
          } else if (!seen.has(field)) {
            seen.add(field);
            ctx.addIssue({ code: "custom", path: ["common", field], message: issue.message });
          }
        }
      });
    }),
  )
  .transform((v) =>
    v.rows.map((row) => {
      const merged = { ...v.common, ...row };
      if (isBlank(row.title)) merged.title = v.common.title;
      return adminTournamentSchema.parse(merged) as TournamentInput;
    }),
  );

export type AdminTournamentParsed = z.output<typeof adminTournamentSchema>;
export type AdminCreateInput = z.output<typeof adminCreateSchema>;
export type AdminUpdateInput = z.output<typeof adminUpdateSchema>;

// Zod のエラーを { field: message } へ平坦化する（同一項目は最初のエラーを採用）。
// 一括登録のように path が入れ子の場合は "rows.0.eventDate" のように "." で連結する。
export function flattenAdminIssues(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}


