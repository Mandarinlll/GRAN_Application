"use server";

// 設定機能の Server Actions（プロフィール更新・パスワード変更・アプリ設定の保存）。
//
// セキュリティ方針（コーディング規約 7）:
//  - 入力は Zod で検証し、失敗時はフィールド単位のエラーを返す。
//  - 操作対象は常にセッションのユーザー本人のみ（ID をクライアントから受け取らない）。
//  - パスワード変更は現在のパスワードを必ず照合する。
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  emailTakenByOther,
  findPasswordHashById,
  updatePasswordHash,
  updateUserProfile,
} from "@/features/auth/server/userRepository";
import {
  appSettingsSchema,
  passwordChangeSchema,
  profileSchema,
} from "@/features/settings/types/schema";
import { saveSettings } from "@/features/settings/server/settingsRepository";
import { joinName } from "@/features/settings/utils/name";
import type { AppSettings } from "@/features/settings/types/settings";

export interface SettingsActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  // 再入力用に保持する値（パスワード類は含めない）
  values?: Record<string, string>;
  // 同じ結果でも toast を再表示できるよう毎回変わる値
  nonce?: number;
}

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

function flattenZodErrors(error: import("zod").ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) result[key] = issue.message;
  }
  return result;
}

const UNAUTHORIZED: SettingsActionState = {
  ok: false,
  message: "ログインの有効期限が切れました。再度ログインしてください。",
};

// ---- プロフィール更新 ----
export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await getSession();
  if (!session) return { ...UNAUTHORIZED, nonce: Date.now() };

  const raw = formToObject(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "入力内容をご確認ください。",
      fieldErrors: flattenZodErrors(parsed.error),
      values: raw,
      nonce: Date.now(),
    };
  }
  const d = parsed.data;

  if (emailTakenByOther(d.email, session.sub)) {
    return {
      ok: false,
      message: "更新に失敗しました。",
      fieldErrors: { email: "このメールアドレスは既に登録されています" },
      values: raw,
      nonce: Date.now(),
    };
  }

  try {
    updateUserProfile(session.sub, {
      realName: joinName(d.lastName, d.firstName),
      kanaName: joinName(d.lastKana, d.firstKana),
      nickname: d.nickname,
      phoneNumber: d.phoneNumber ? d.phoneNumber : null,
      email: d.email,
    });
  } catch {
    return {
      ok: false,
      message: "更新処理でエラーが発生しました。時間をおいて再度お試しください。",
      values: raw,
      nonce: Date.now(),
    };
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "ユーザー情報を更新しました。",
    values: raw,
    nonce: Date.now(),
  };
}

// ---- パスワード変更 ----
export async function changePasswordAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await getSession();
  if (!session) return { ...UNAUTHORIZED, nonce: Date.now() };

  const parsed = passwordChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "入力内容をご確認ください。",
      fieldErrors: flattenZodErrors(parsed.error),
      nonce: Date.now(),
    };
  }
  const { currentPassword, newPassword } = parsed.data;

  const currentHash = findPasswordHashById(session.sub);
  if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
    return {
      ok: false,
      message: "パスワードを変更できませんでした。",
      fieldErrors: { currentPassword: "現在のパスワードが正しくありません" },
      nonce: Date.now(),
    };
  }

  try {
    updatePasswordHash(session.sub, await hashPassword(newPassword));
  } catch {
    return {
      ok: false,
      message: "更新処理でエラーが発生しました。時間をおいて再度お試しください。",
      nonce: Date.now(),
    };
  }
  return { ok: true, message: "パスワードを変更しました。", nonce: Date.now() };
}

// ---- アプリ設定の保存（トグル/選択のたびに呼ばれる） ----
export async function saveAppSettingsAction(
  input: AppSettings,
): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: UNAUTHORIZED.message };

  const parsed = appSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "設定値が正しくありません。" };
  }
  try {
    saveSettings(session.sub, parsed.data);
  } catch {
    return { ok: false, message: "設定を保存できませんでした。" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
