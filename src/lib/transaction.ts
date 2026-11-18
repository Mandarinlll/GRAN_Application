import { db } from "@/lib/db";

/**
 * BEGIN IMMEDIATE のトランザクション内で fn を実行する。
 * - fn は同期関数。Promise を返す関数は渡さないこと。
 * - `{ ok: false }` を返すと ROLLBACK、`{ ok: true }` で COMMIT。
 * - 例外時は ROLLBACK して再スローする（サービス層が INTERNAL に変換する）。
 * - 入れ子は不可。
 */
export function runInTransaction<R extends { ok: boolean }>(fn: () => R): R {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec(result.ok ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // トランザクションが既に終了している場合は無視し、元の例外を優先する
    }
    throw e;
  }
}
