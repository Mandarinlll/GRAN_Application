// セッション失効用の DB アクセス。

import { db } from "@/lib/db";
import type { SessionStateRow } from "@/lib/sessionValidity";

export function findSessionState(userId: string): SessionStateRow | null {
  const row = db
    .prepare("SELECT status, session_version FROM users WHERE id = ?")
    .get(userId) as { status: string; session_version: number } | undefined;
  if (!row) return null;
  return { status: row.status, session_version: Number(row.session_version) };
}

// 発行済みセッションを失効させる。呼び出し側のトランザクション内で実行する。
export function revokeSessions(userId: string): void {
  db.prepare(
    "UPDATE users SET session_version = session_version + 1 WHERE id = ?",
  ).run(userId);
}
