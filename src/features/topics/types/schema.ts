// トピックス入力の検証（Zod）。
import { z } from "zod";

export const MAX_TITLE_LENGTH = 60;

// 内部パス（/ 始まり、// は除く）または https のみ許可（TopicsCarousel と同じ基準）。
const LINK_PATTERN = /^(\/(?!\/)[^\s\\]*|https:\/\/[^\s\\]+)$/;

// "" を null に正規化する。
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

// datetime-local の "YYYY-MM-DDTHH:mm" を DB 形式 "YYYY-MM-DD HH:mm:00" へ。不正なら検証エラー。
const dateTime = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, "日時の形式が正しくありません")
    .transform((s) => {
      const t = s.replace("T", " ");
      return t.length === 16 ? `${t}:00` : t;
    })
    .refine((s) => !Number.isNaN(Date.parse(s.replace(" ", "T") + "Z")), "日時が正しくありません")
    .nullable(),
);

const title = z
  .string()
  .trim()
  .min(1, "タイトルを入力してください")
  .max(MAX_TITLE_LENGTH, `タイトルは${MAX_TITLE_LENGTH}文字以内にしてください`);

const linkUrl = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(2000)
    .regex(LINK_PATTERN, "リンク先は「/」始まりの内部パスか https のURLを指定してください")
    .nullable(),
);

const bool = z.preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean());

const periodOk = (v: { publishFrom?: string | null; publishUntil?: string | null }) =>
  !v.publishFrom || !v.publishUntil || v.publishFrom <= v.publishUntil;
const periodMessage = { message: "公開終了は公開開始より後にしてください", path: ["publishUntil"] };

// 新規作成。
export const createTopicSchema = z
  .object({
    title,
    linkUrl: linkUrl.default(null),
    publishFrom: dateTime.default(null),
    publishUntil: dateTime.default(null),
    isPublished: bool.default(true),
  })
  .refine(periodOk, periodMessage);

// 更新（指定されたフィールドのみ反映）。
export const updateTopicSchema = z
  .object({
    title: title.optional(),
    linkUrl: linkUrl.optional(),
    publishFrom: dateTime.optional(),
    publishUntil: dateTime.optional(),
    isPublished: bool.optional(),
  })
  .refine(periodOk, periodMessage);

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
