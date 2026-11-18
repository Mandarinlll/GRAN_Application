// Route Handler 共通ヘルパー（UUID 判定・JSON オブジェクト本文の読み取り）。
import type { NextResponse } from "next/server";
import { MSG_NOT_FOUND } from "@/features/accounts/server/accessResult";
import { badRequest, toResponse } from "@/features/accounts/server/httpResult";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function notFoundResponse(): NextResponse {
  return toResponse({ ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND });
}

// 本文が JSON オブジェクトでなければ null。
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export { badRequest };
