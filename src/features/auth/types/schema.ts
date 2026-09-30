// 認証機能の Zod バリデーションスキーマ（コーディング規約 3.1 / 7 準拠）。
// クライアント入力は unknown として受け取り、必ずここで検証する。

import { z } from "zod";

// パスワード共通ルール: 8文字以上・英字と数字を各1文字以上含む。
const passwordRule = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください")
  .regex(/[A-Za-z]/, "パスワードには英字を含めてください")
  .regex(/[0-9]/, "パスワードには数字を含めてください");

// 新規登録スキーマ。register 画面の入力項目に対応。
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, "メールアドレスを入力してください")
      .email("メールアドレスの形式が正しくありません"),
    password: passwordRule,
    passwordConfirm: z.string().min(1, "確認用パスワードを入力してください"),
    lastName: z.string().min(1, "姓を入力してください").max(20),
    firstName: z.string().min(1, "名を入力してください").max(20),
    lastKana: z
      .string()
      .min(1, "セイ（フリガナ）を入力してください")
      .max(20)
      .regex(/^[ァ-ヶー　\s]+$/, "フリガナは全角カタカナで入力してください"),
    firstKana: z
      .string()
      .min(1, "メイ（フリガナ）を入力してください")
      .max(20)
      .regex(/^[ァ-ヶー　\s]+$/, "フリガナは全角カタカナで入力してください"),
    nickname: z.string().min(1, "ニックネームを入力してください").max(40),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    birthDate: z.string().min(1, "生年月日を入力してください"),
    phoneNumber: z
      .string()
      .max(15)
      .regex(/^[0-9-]*$/, "電話番号は数字とハイフンで入力してください")
      .optional()
      .or(z.literal("")),
    declaredClass: z.enum(["A", "AB", "B", "BC", "C", "CD", "D", "DE"]),
    agree: z
      .union([z.literal("on"), z.literal(true), z.literal("true")])
      .refine((v) => v === "on" || v === true || v === "true", {
        message: "利用規約への同意が必要です",
      }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "パスワードが一致しません",
    path: ["passwordConfirm"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ログインスキーマ。ログインID または メールアドレス + パスワード。
export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "ログインID またはメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export type LoginInput = z.infer<typeof loginSchema>;
