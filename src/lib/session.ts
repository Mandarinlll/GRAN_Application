// セッション管理（JWT + HttpOnly Cookie）。
// requirements-detail-user.md 1.3 のハイブリッド認証方式に準拠する。
//
// 本実装では簡潔さのため単一のセッショントークン（Access Token 相当）を
// HttpOnly Cookie に格納する。属性は Secure / SameSite=Lax を必須とする。
// Refresh Token による自動再発行は、将来 DB 側の失効管理を追加して拡張する余地を残す。

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/types/user";

// Cookie 名とセッション有効期限（7日）。
export const SESSION_COOKIE = "gran_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

// JWT 署名鍵。鍵が漏れるとセッション偽造（なりすまし）が可能になるため、
// 本番環境では必ず環境変数 AUTH_SECRET を設定する。
//  - 本番(NODE_ENV=production): 未設定なら即座に例外で起動を止める（弱い既定値へのフォールバック禁止）。
//  - 開発: 利便性のため既定値を許可するが、本番では決して使われない。
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET が設定されていません。本番環境では十分に長いランダムな署名鍵を環境変数に設定してください。",
      );
    }
    // 開発環境のみ: 既定値を使用する（本番には絶対に持ち込まない）。
    return new TextEncoder().encode(
      "dev-only-insecure-secret-change-in-production",
    );
  }

  return new TextEncoder().encode(secret);
}

// セッションペイロードを署名付き JWT へ変換する。
export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

// JWT を検証してペイロードを復元する。無効なら null。
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub === "string" &&
      typeof payload.loginId === "string" &&
      typeof payload.role === "string" &&
      typeof payload.isAdmin === "boolean"
    ) {
      return {
        sub: payload.sub,
        loginId: payload.loginId as string,
        role: payload.role as SessionPayload["role"],
        isAdmin: payload.isAdmin,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// セッション Cookie を発行する（ログイン成功時）。
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

// セッション Cookie を破棄する（ログアウト時）。
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// 現在のリクエストのセッションを取得する。未ログインなら null。
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
