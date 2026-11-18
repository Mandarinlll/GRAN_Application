// 管理コンソールの権限定義。
// requirements-detail-administrator.md 1.1 / 1.3 に準拠する。

// 管理コンソール内での実効ロール。users.role の ADMIN / OPERATOR に対応する。
export type AdminRole = "ADMIN" | "OPERATOR";

// 管理コンソールで操作を区別するための権限。
export type AdminPermission =
  | "console.access" // 管理コンソールへの入場（ダッシュボード閲覧）
  | "entries.view" // エントリー確認
  | "entries.manage" // エントリーの支払い状態変更・削除（ADMIN のみ）
  | "scores.input" // スコア入力
  | "notifications.manage" // 通知管理(運営からのお知らせ・緊急連絡の配信)
  | "topics.manage" // ホーム画面トピックスの管理
  | "tournaments.manage" // 大会の登録・編集・料金変更
  | "accounts.manage" // アカウント追加・停止/削除・PW強制リセット
  | "roles.manage"; // 権限（role）の変更

// ガード通過後に呼び出し側へ渡す管理者コンテキスト。
export interface AdminContext {
  userId: string;
  loginId: string;
  role: AdminRole;
}

// 管理者として認可されなかった理由。
export type AdminDenyReason =
  | "UNAUTHENTICATED" // 未ログイン / セッション不整合
  | "FORBIDDEN"; // ログイン済みだが管理者権限なし、または権限不足

export type AdminAccessResult =
  | { ok: true; admin: AdminContext }
  | { ok: false; reason: AdminDenyReason };
