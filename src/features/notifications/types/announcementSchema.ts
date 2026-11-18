// 運営からのお知らせ・緊急連絡の入力検証（zod）。
import { z } from "zod";

export const MAX_ANNOUNCEMENT_TITLE = 60;
export const MAX_ANNOUNCEMENT_BODY = 1000;

export const createAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "タイトルを入力してください")
      .max(MAX_ANNOUNCEMENT_TITLE, `タイトルは${MAX_ANNOUNCEMENT_TITLE}文字以内で入力してください`),
    body: z
      .string()
      .trim()
      .min(1, "本文を入力してください")
      .max(MAX_ANNOUNCEMENT_BODY, `本文は${MAX_ANNOUNCEMENT_BODY}文字以内で入力してください`),
    isUrgent: z.boolean().default(false),
    // ALL: 全ユーザー / TOURNAMENT: 指定大会の確定エントリー者（申込者と登録済みメンバー）
    audience: z.enum(["ALL", "TOURNAMENT"]),
    tournamentId: z.string().min(1).max(100).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "TOURNAMENT" && !v.tournamentId) {
      ctx.addIssue({ code: "custom", path: ["tournamentId"], message: "対象の大会を選択してください" });
    }
  });

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;