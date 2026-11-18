// アカウントのロック状態判定。画面表示・ロック解除の前提確認は、この定義を共通で使う。

export const LOCKED_SQL =
  "(u.failed_login_attempts >= 10 OR (u.locked_until IS NOT NULL AND u.locked_until > datetime('now','+9 hours')))";

// nowJst は "YYYY-MM-DD HH:mm:ss"（JST 固定形式なので文字列比較でよい）。
export function isAccountLocked(
  u: { failedLoginAttempts: number; lockedUntil: string | null },
  nowJst: string,
): boolean {
  if (u.failedLoginAttempts >= 10) return true;
  return u.lockedUntil !== null && u.lockedUntil > nowJst;
}
