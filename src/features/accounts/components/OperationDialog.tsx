// 管理操作の確認ダイアログ（ロック解除・再発行・停止・再開・権限変更・削除・除名・解散で共通）。
// - 確定までサーバー処理を呼ばない。確定時の fetch は 1 回だけ（ref で同期ガード）
// - 30 秒の AbortController。タイムアウト時はダイアログを開いたまま確定ボタンを再度有効化する
// - 確認テキスト不一致（VALIDATION + fieldErrors.confirm）はダイアログを開いたままエラー表示
// - その他のエラーはダイアログを閉じてトーストで通知し、画面は変更しない
// - 成功時はダイアログを閉じ、トーストを出し、router.refresh() で表示を更新する
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastState } from "@/components/ui/Toast";
import {
  NETWORK_MESSAGE,
  OPERATION_TIMEOUT_MS,
  buildErrorMessage,
  buildTimeoutMessage,
  normalizeErrorCode,
} from "../utils/operationMessages";

export interface OperationConfirmText {
  /** 入力欄のラベル（例: 「ユーザーID」「チーム名」） */
  label: string;
  /** リクエスト本文のキー（例: confirmLoginId / confirmName） */
  bodyKey: string;
  /** 入力を求める値の説明（表示のみ。照合はサーバーが行う） */
  hint?: string;
}

export interface OperationDialogProps {
  open: boolean;
  /** 操作対象の名称（ユーザー名・チーム名など） */
  targetName: string;
  /** 操作の種類（例: 「パスワード再発行」） */
  operationLabel: string;
  /** ダイアログ内の補足説明 */
  description?: string;
  confirmLabel?: string;
  variant?: "primary" | "destructive";
  method: "POST" | "DELETE";
  url: string;
  /** JSON 本文（確認テキストは confirm.bodyKey として自動で加える） */
  body?: Record<string, unknown>;
  confirm?: OperationConfirmText;
  successMessage: string;
  /** 成功時の応答本文（Initial_Password の受け取りなど）。state にだけ保持すること */
  onSuccess?: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function OperationDialog({
  open,
  targetName,
  operationLabel,
  description,
  confirmLabel,
  variant = "primary",
  method,
  url,
  body,
  confirm,
  successMessage,
  onSuccess,
  onClose,
}: OperationDialogProps) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // 開くたびに入力とエラーを初期化する
  useEffect(() => {
    if (open) {
      setConfirmValue("");
      setFieldError(null);
      setInlineError(null);
    }
  }, [open]);

  // アンマウント時に進行中の通信を中止する
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = useCallback(async () => {
    if (inFlight.current) return; // 15.5: 追加の確定操作で呼び出さない
    inFlight.current = true;
    setBusy(true);
    setFieldError(null);
    setInlineError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, OPERATION_TIMEOUT_MS);

    try {
      const payload: Record<string, unknown> = { ...(body ?? {}) };
      if (confirm) payload[confirm.bodyKey] = confirmValue;
      const hasBody = method !== "DELETE" || confirm !== undefined || body !== undefined;

      const res = await fetch(url, {
        method,
        headers: hasBody ? { "Content-Type": "application/json" } : undefined,
        body: hasBody ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      let data: Record<string, unknown> = {};
      try {
        const parsed: unknown = await res.json();
        if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
      } catch {
        // 本文なし
      }

      if (res.ok && data.ok !== false) {
        onSuccess?.(data);
        setToast({ type: "success", message: successMessage });
        onClose();
        router.refresh(); // 15.6
        return;
      }

      const code = normalizeErrorCode(data.code);
      const fieldErrors = data.fieldErrors as Record<string, unknown> | undefined;
      if (code === "VALIDATION" && confirm && typeof fieldErrors?.confirm === "string") {
        // 10.2 / 13.2: ダイアログを開いたまま不一致を表示する
        setFieldError(fieldErrors.confirm);
        return;
      }

      // 15.7: ダイアログを閉じ、画面の表示内容は変更しない
      setToast({ type: "error", message: buildErrorMessage(operationLabel, code, data.message) });
      onClose();
    } catch {
      if (timedOut) {
        // 15.8: 開いたまま確定ボタンを再度有効化する
        const message = buildTimeoutMessage(operationLabel);
        setInlineError(message);
        setToast({ type: "error", message });
      } else if (controller.signal.aborted) {
        // アンマウントによる中止。何も表示しない
      } else {
        setToast({ type: "error", message: `「${operationLabel}」を実行できませんでした。${NETWORK_MESSAGE}` });
        onClose();
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      inFlight.current = false;
      setBusy(false);
    }
  }, [body, confirm, confirmValue, method, onClose, onSuccess, operationLabel, router, successMessage, url]);

  const describedBy = [fieldError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <ConfirmDialog
        open={open}
        title={`${operationLabel}を実行しますか？`}
        description={
          <span>
            対象: <span className="font-medium text-slate-800">{targetName}</span>
            {description ? <span className="block mt-1">{description}</span> : null}
          </span>
        }
        confirmLabel={confirmLabel ?? operationLabel}
        cancelLabel="キャンセル"
        variant={variant}
        busy={busy}
        onConfirm={submit}
        onCancel={onClose}
      >
        {confirm && (
          <div className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
              {confirm.label}
            </label>
            {confirm.hint && <p className="text-[13px] text-slate-600 break-all">{confirm.hint}</p>}
            <input
              id={inputId}
              type="text"
              value={confirmValue}
              onChange={(e) => {
                setConfirmValue(e.target.value);
                setFieldError(null);
              }}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={describedBy}
              className="block min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
            {fieldError && (
              <p id={errorId} role="alert" className="text-[13px] text-rose-600">
                {fieldError}
              </p>
            )}
          </div>
        )}
        {inlineError && (
          <p role="alert" className="mt-3 text-[13px] text-rose-600">
            {inlineError}
          </p>
        )}
      </ConfirmDialog>
      <Toast toast={toast} onClose={closeToast} durationMs={4000} />
    </>
  );
}
