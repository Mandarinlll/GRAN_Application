"use server";

// 認証系の Server Actions（新規登録・ログイン・ログアウト）の薄いアダプタ。
// クライアントのフォームから直接呼び出され、セッション発行と画面遷移を担う。
//
// OOP 化（oop-architecture.md §2.6）に伴い、ドメイン判断（メール重複・資格照合・
// ロック/停止判定・失敗記録・初期レベル算出）は AuthApplicationService へ移設した。
// 本アダプタの責務は「セッション取得/Zod 検証 + コンポジションルートからの配線 +
// 結果 → AuthActionState 変換 + Next.js 固有処理（Cookie 発行・redirect）」に限定する。
//
// セキュリティ方針（コーディング規約 7）:
//  - 入力は Zod で検証し、失敗時はフィールド単位のエラーを返す。
//  - DB例外や内部詳細はクライアントへ返さず、汎用メッセージへマッピングする。
//  - ログイン失敗はアカウント存在有無を隠蔽する汎用メッセージで統一する。

import { redirect } from "next/navigation";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { loginSchema, registerSchema } from "@/features/auth/types/schema";
import { createAuthApplicationService } from "@/server/container";

// フォーム送信の結果型。成功時は redirect するため、実質エラー時のみ返る。
export interface AuthActionState {
  ok: boolean;
  message?: string; // 全体エラーメッセージ
  fieldErrors?: Record<string, string>; // フィールド単位のエラー
  values?: Record<string, string>; // 再入力用に保持する入力値（パスワード除く）
}

// FormData を素の文字列レコードへ変換する補助。
function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

// Zod のエラーを { field: message } へ平坦化する。
function flattenZodErrors(
  error: import("zod").ZodError,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

// ---- 新規登録 ----
export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = formToObject(formData);

  // 再入力用に保持する値（パスワードは保持しない）。
  const keep: Record<string, string> = { ...raw };
  delete keep.password;
  delete keep.passwordConfirm;

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "入力内容をご確認ください。",
      fieldErrors: flattenZodErrors(parsed.error),
      values: keep,
    };
  }

  const data = parsed.data;

  try {
    const outcome = await createAuthApplicationService().register({
      email: data.email,
      password: data.password,
      realName: `${data.lastName} ${data.firstName}`,
      kanaName: `${data.lastKana} ${data.firstKana}`,
      nickname: data.nickname,
      gender: data.gender,
      birthDate: data.birthDate,
      phoneNumber: data.phoneNumber ? data.phoneNumber : null,
      declaredClass: data.declaredClass,
    });

    // メール重複チェック。
    if (outcome.kind === "emailTaken") {
      return {
        ok: false,
        message: "登録に失敗しました。",
        fieldErrors: { email: "このメールアドレスは既に登録されています" },
        values: keep,
      };
    }

    // 登録完了後、そのままログイン状態にしてセッションを発行する。
    await setSessionCookie({
      sub: outcome.user.id,
      loginId: outcome.user.loginId,
      role: outcome.user.role,
      isAdmin: outcome.user.isAdmin,
    });
  } catch {
    return {
      ok: false,
      message:
        "登録処理でエラーが発生しました。時間をおいて再度お試しください。",
      values: keep,
    };
  }

  // 成功: ホームへ。redirect は例外で制御を移すため try の外で呼ぶ。
  redirect("/");
}

// ---- ログイン ----
export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = formToObject(formData);
  const keep = { identifier: raw.identifier ?? "" };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: flattenZodErrors(parsed.error),
      values: keep,
    };
  }

  const { identifier, password } = parsed.data;

  // 汎用エラー（ユーザー列挙防止のため存在有無を区別しない）。
  const genericError: AuthActionState = {
    ok: false,
    message: "ログインID またはパスワードが正しくありません。",
    values: keep,
  };

  const outcome = await createAuthApplicationService().login(
    identifier,
    password,
  );

  // 存在しない / パスワード不一致は汎用エラーで統一する。
  if (outcome.kind === "invalidCredentials") {
    return genericError;
  }

  // ロック中の案内（requirements-detail-user.md 1.4）。
  if (outcome.kind === "locked") {
    return {
      ok: false,
      message:
        "パスワードの入力試行回数が上限を超えました。安全のためアカウントをロックしています。管理者へお問い合わせください。",
      values: keep,
    };
  }

  // 停止アカウントの拒否。
  if (outcome.kind === "suspended") {
    return {
      ok: false,
      message: "このアカウントは現在利用できません。管理者へお問い合わせください。",
      values: keep,
    };
  }

  // 認証成功。セッション発行。
  await setSessionCookie({
    sub: outcome.user.id,
    loginId: outcome.user.loginId,
    role: outcome.user.role,
    isAdmin: outcome.user.isAdmin,
  });

  redirect("/");
}

// ---- ログアウト ----
export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
