// 設定機能の Zod バリデーションスキーマ（コーディング規約 3.1 / 7 準拠）。
import { z } from "zod";

const kanaRule = z
  .string()
  .min(1, "必須項目です")
  .max(20, "20文字以内で入力してください")
  .regex(/^[ァ-ヶー　\s]+$/, "フリガナは全角カタカナで入力してください");

// プロフィール編集（氏名・フリガナ・ニックネーム・電話番号・メールアドレス）。
export const profileSchema = z.object({
  lastName: z.string().trim().min(1, "姓を入力してください").max(20, "20文字以内で入力してください"),
  firstName: z.string().trim().min(1, "名を入力してください").max(20, "20文字以内で入力してください"),
  lastKana: kanaRule,
  firstKana: kanaRule,
  nickname: z
    .string()
    .trim()
    .min(1, "ニックネームを入力してください")
    .max(40, "40文字以内で入力してください"),
  phoneNumber: z
    .string()
    .trim()
    .max(15, "15文字以内で入力してください")
    .regex(/^[0-9-]*$/, "電話番号は数字とハイフンで入力してください"),
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .email("メールアドレスの形式が正しくありません"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// パスワード変更。新パスワードは登録時と同じルール。
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
    newPassword: z
      .string()
      .min(8, "パスワードは8文字以上で入力してください")
      .regex(/[A-Za-z]/, "パスワードには英字を含めてください")
      .regex(/[0-9]/, "パスワードには数字を含めてください"),
    newPasswordConfirm: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: "パスワードが一致しません",
    path: ["newPasswordConfirm"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "現在のパスワードと異なるものを設定してください",
    path: ["newPassword"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

// アプリ設定。
export const appSettingsSchema = z.object({
  notifyReminder: z.boolean(),
  notifyMemberAssign: z.boolean(),
  fontSize: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  colorMode: z.enum(["LIGHT", "DARK", "SYSTEM"]),
});
