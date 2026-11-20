// ServiceResult を Route Handler の HTTP 応答へ変換する。
// 失敗時は { ok:false, code, reason?, message, fieldErrors? }。INTERNAL の詳細は返さない。
import { NextResponse } from "next/server";
import type { ErrorCode, ServiceResult } from "@/features/accounts/types/account";

const GENERIC_ERROR = "処理に失敗しました。時間をおいて再度お試しください。";

export function statusForError(code: ErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 400;
    case "CONFLICT":
      return 409;
    case "INTERNAL":
    default:
      return 500;
  }
}

export function errorResponse(result: Extract<ServiceResult<unknown>, { ok: false }>): NextResponse {
  const status = statusForError(result.code);
  return NextResponse.json(
    {
      ok: false,
      code: result.code,
      ...(result.reason && status !== 500 ? { reason: result.reason } : {}),
      message: status === 500 ? GENERIC_ERROR : result.message,
      ...(result.fieldErrors && status !== 500 ? { fieldErrors: result.fieldErrors } : {}),
    },
    { status },
  );
}

// initialPassword を含む応答は保存・キャッシュさせない。
export function toResponse<T>(
  result: ServiceResult<T>,
  toBody: (data: T) => Record<string, unknown> = () => ({}),
): NextResponse {
  if (!result.ok) return errorResponse(result);
  const body = { ok: true, ...toBody(result.data) };
  const res = NextResponse.json(body, { status: 200 });
  if ("initialPassword" in body) res.headers.set("Cache-Control", "no-store");
  return res;
}

export function badRequest(message = "リクエストが不正です。"): NextResponse {
  return NextResponse.json({ ok: false, code: "VALIDATION", message }, { status: 400 });
}

export function internalError(): NextResponse {
  return NextResponse.json({ ok: false, code: "INTERNAL", message: GENERIC_ERROR }, { status: 500 });
}

// 予期しない例外は詳細を返さない 500 にする。
export async function guarded(fn: () => Promise<NextResponse> | NextResponse): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    console.error("[accounts] unexpected error", e);
    return internalError();
  }
}
