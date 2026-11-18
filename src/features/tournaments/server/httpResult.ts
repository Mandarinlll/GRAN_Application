// サービス層の ServiceResult を Route Handler の HTTP 応答へ変換する。
// 応答は { ok, message, fieldErrors } 形式。例外の詳細は返さない。
import { NextResponse } from "next/server";
import type { ErrorCode, ServiceResult } from "@/features/tournaments/types/adminTournament";

const GENERIC_ERROR = "処理に失敗しました。時間をおいて再度お試しください。";

export function statusForError(code: ErrorCode, httpStatus?: number): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "IMAGE":
      return httpStatus === 413 || httpStatus === 415 ? httpStatus : 400;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT_STALE":
    case "FORBIDDEN_TRANSITION":
    case "LOCKED_FIELD":
    case "CAPACITY_BELOW_CONFIRMED":
    case "HAS_ENTRIES":
    case "HAS_COPIES":
    case "NOT_DRAFT":
      return 409;
    case "ALREADY_UPDATED":
      return 200;
    case "DB_ERROR":
    default:
      return 500;
  }
}

export function errorResponse(result: Extract<ServiceResult, { ok: false }>): NextResponse {
  const status = statusForError(result.code, result.httpStatus);
  return NextResponse.json(
    {
      ok: result.code === "ALREADY_UPDATED",
      code: result.code,
      message: status === 500 ? GENERIC_ERROR : result.message,
      fieldErrors: result.fieldErrors ?? {},
    },
    { status },
  );
}

export function badRequest(message = "リクエストが不正です。"): NextResponse {
  return NextResponse.json({ ok: false, message, fieldErrors: {} }, { status: 400 });
}

export function internalError(): NextResponse {
  return NextResponse.json({ ok: false, message: GENERIC_ERROR, fieldErrors: {} }, { status: 500 });
}

// 予期しない例外を握りつぶし、詳細を返さない 500 にする。
export async function guarded(fn: () => Promise<NextResponse> | NextResponse): Promise<NextResponse> {
  try {
    return await fn();
  } catch {
    return internalError();
  }
}
