// データタブ Route Handler の共通ラッパ。
// 認証・本人確認・zod 入力検証・エラー変換・Cache-Control: no-store を一箇所に集約する。

import type { ZodType } from "zod";
import {
  assertSelf,
  errorResponse,
  requireSession,
  type ApiErrorCode,
} from "./authGuard";

// ハンドラ内から投げて、対応するエラー応答に変換させるための例外。
export class ApiError extends Error {
  constructor(
    public readonly code: Exclude<ApiErrorCode, "INTERNAL">,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(body: T): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export interface HandlerContext<Q, P> {
  userId: string;
  query: Q;
  params: P;
}

interface Options<Q> {
  // クエリ文字列（userId を除く）の検証スキーマ。省略時は検証しない。
  querySchema?: ZodType<Q>;
}

// Next.js の動的セグメント: params は Promise で渡される。
type RouteArg<P> = { params?: Promise<P> | P } | undefined;

export function withDataHandler<Q = Record<string, never>, P = Record<string, never>>(
  handler: (ctx: HandlerContext<Q, P>) => Promise<unknown> | unknown,
  options: Options<Q> = {},
): (request: Request, routeArg?: RouteArg<P>) => Promise<Response> {
  return async (request, routeArg) => {
    try {
      const session = await requireSession();
      if (session instanceof Response) return session;

      const url = new URL(request.url);
      const forbidden = assertSelf(session.userId, url.searchParams.get("userId"));
      if (forbidden) return forbidden;

      let query = {} as Q;
      if (options.querySchema) {
        const raw: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          if (key !== "userId") raw[key] = value;
        });
        const parsed = options.querySchema.safeParse(raw);
        if (!parsed.success) {
          return errorResponse("BAD_REQUEST", "リクエストの内容が正しくありません。");
        }
        query = parsed.data;
      }

      const params = ((await routeArg?.params) ?? {}) as P;
      const result = await handler({ userId: session.userId, query, params });
      return result instanceof Response ? result : jsonOk(result);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.code, e.message);
      // DB 例外などの詳細はログのみ。レスポンスには含めない。
      console.error("[data-api] unexpected error", e);
      return errorResponse("INTERNAL", "データの取得に失敗しました。");
    }
  };
}
