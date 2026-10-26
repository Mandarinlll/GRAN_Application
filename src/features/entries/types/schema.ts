// エントリー機能の Zod バリデーションスキーマ（コーディング規約 3.1 / 7 準拠）。
// Server Action に渡る入力は unknown として受け取り、必ずここで検証する。

import { z } from "zod";

// メンバー1枠分の入力。種別に応じて必要な値が変わる。
//  - REGISTERED: userId 必須（チーム内ユーザー）
//  - GUEST     : guestName 必須（チーム外・氏名入力）
//  - PENDING   : どちらも不要（未定枠）
export const entryMemberInputSchema = z
  .object({
    memberType: z.enum(["REGISTERED", "GUEST", "PENDING"]),
    userId: z.string().optional(),
    guestName: z.string().max(40).optional(),
    orderNo: z.number().int().min(1),
  })
  .refine(
    (m) => m.memberType !== "REGISTERED" || (m.userId && m.userId.length > 0),
    { message: "チーム内メンバーはユーザーを指定してください", path: ["userId"] },
  )
  .refine(
    (m) =>
      m.memberType !== "GUEST" || (m.guestName && m.guestName.trim().length > 0),
    { message: "ゲスト枠は氏名を入力してください", path: ["guestName"] },
  );

export type EntryMemberInput = z.infer<typeof entryMemberInputSchema>;

// 単一大会エントリー申込スキーマ。
export const entryCreateSchema = z.object({
  tournamentId: z.string().min(1, "大会が指定されていません"),
  // 団体戦・ダブルスのときに必須。シングルスでは無視される。
  teamId: z.string().optional(),
  // メンバー構成。シングルスは本人のみなので空でも可（サーバー側で本人を補完）。
  members: z.array(entryMemberInputSchema).max(10).default([]),
  // 同日重複がある場合に「承認後にエントリー」とするため、確認済みフラグを受け取る。
  acknowledgeConflict: z.boolean().default(false),
  // 規約同意（キャンセルポリシー含む）。
  agreeTerms: z.boolean().refine((v) => v === true, {
    message: "参加規約・キャンセルポリシーへの同意が必要です",
  }),
});

export type EntryCreateInput = z.infer<typeof entryCreateSchema>;

// 一括エントリー申込スキーマ（複数大会を同一メンバー構成でまとめて申込）。
export const bulkEntryCreateSchema = z.object({
  tournamentIds: z
    .array(z.string().min(1))
    .min(1, "大会を1件以上選択してください")
    .max(20),
  teamId: z.string().optional(),
  members: z.array(entryMemberInputSchema).max(10).default([]),
  acknowledgeConflict: z.boolean().default(false),
  agreeTerms: z.boolean().refine((v) => v === true, {
    message: "参加規約・キャンセルポリシーへの同意が必要です",
  }),
});

export type BulkEntryCreateInput = z.infer<typeof bulkEntryCreateSchema>;

// キャンセル待ち登録スキーマ。
export const waitlistCreateSchema = z.object({
  tournamentId: z.string().min(1, "大会が指定されていません"),
  teamId: z.string().optional(),
});

export type WaitlistCreateInput = z.infer<typeof waitlistCreateSchema>;

// エントリーキャンセル申請スキーマ。
export const cancelEntrySchema = z.object({
  entryId: z.string().min(1, "エントリーが指定されていません"),
});

export type CancelEntryInput = z.infer<typeof cancelEntrySchema>;

// メンバー更新スキーマ（未定枠割当・差し替え）。
export const updateMembersSchema = z.object({
  entryId: z.string().min(1, "エントリーが指定されていません"),
  members: z.array(entryMemberInputSchema).min(1).max(10),
});

export type UpdateMembersInput = z.infer<typeof updateMembersSchema>;
