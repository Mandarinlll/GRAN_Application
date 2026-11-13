// データタブ API の認証ガード（要件 11.1〜11.3）。
// 失敗時は Error を投げず、そのまま返せる Response を返す。

import { getSession } from "@/lib/session";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

// 共通エラー形式 { error: { code, message } }。データ本文は含めない。
export function errorResponse(code: ApiErrorCode, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: STATUS_BY_CODE[code],
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// 未ログインは 401 Response、ログイン済みなら { userId }。
export async function requireSession(): Promise<{ userId: string } | Response> {
  const session = await getSession();
  if (!session) {
    return errorResponse(
      "UNAUTHENTICATED",
      "この操作にはログインが必要です。",
    );
  }
  return { userId: session.sub };
}

// リクエストされた userId がセッションと異なれば 403。未指定（null）は本人扱い。
export function assertSelf(
  sessionUserId: string,
  requested: string | null,
): Response | null {
  if (requested !== null && requested !== sessionUserId) {
    return errorResponse("FORBIDDEN", "他のユーザーのデータにはアクセスできません。");
  }
  return null;
}
