// 管理操作ダイアログの日本語エラーメッセージ（純粋関数）。
import type { ErrorCode } from "../types/account";

export const OPERATION_TIMEOUT_MS = 30_000;

const CODE_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION: "入力内容に誤りがあります。",
  UNAUTHENTICATED: "ログインの有効期限が切れています。再度ログインしてください。",
  FORBIDDEN: "この操作を行う権限がありません。",
  NOT_FOUND: "対象が見つかりませんでした。すでに削除されている可能性があります。",
  CONFLICT: "現在の状態では実行できません。画面を更新して状態を確認してください。",
  INTERNAL: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
};

export const TIMEOUT_MESSAGE =
  "処理が 30 秒以内に完了しませんでした（タイムアウト）。時間をおいて再度お試しください。";
export const NETWORK_MESSAGE = "通信に失敗しました。時間をおいて再度お試しください。";

const KNOWN_CODES = new Set<string>(Object.keys(CODE_MESSAGE));

export function normalizeErrorCode(code: unknown): ErrorCode {
  return typeof code === "string" && KNOWN_CODES.has(code) ? (code as ErrorCode) : "INTERNAL";
}

/** 失敗した操作と原因を示す日本語メッセージ。サーバーの message があれば原因として優先する。 */
export function buildErrorMessage(
  operationLabel: string,
  code: ErrorCode,
  serverMessage?: unknown,
): string {
  const cause =
    typeof serverMessage === "string" && serverMessage.trim() !== ""
      ? serverMessage
      : CODE_MESSAGE[code];
  return `「${operationLabel}」を実行できませんでした。${cause}`;
}

export function buildTimeoutMessage(operationLabel: string): string {
  return `「${operationLabel}」を実行できませんでした。${TIMEOUT_MESSAGE}`;
}
