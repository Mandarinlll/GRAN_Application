// 共通の確認ダイアログ（ui-design-system.md 準拠、Lucide のみ使用）。
// - role="dialog" / aria-modal、開いたらキャンセルボタンへフォーカス、閉じたら元の要素へ戻す
// - Esc とキャンセルで閉じる（処理中は閉じない）、Tab はダイアログ内で循環
// - ボタンは高さ 44px 以上
// - 二重送信防止: state ではなく ref で同期的に busy を判定する
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive は中止・削除など取り消しにくい操作に使う */
  variant?: "primary" | "destructive";
  /** 親側で処理中を管理する場合に指定する（任意） */
  busy?: boolean;
  /** Promise を返す場合、完了まで busy 扱いにする */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "実行する",
  cancelLabel = "キャンセル",
  variant = "primary",
  busy: busyProp = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const [innerBusy, setInnerBusy] = useState(false);
  const busy = busyProp || innerBusy;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 親が busy を管理する場合も同期ガードへ反映する
  useEffect(() => {
    if (busyProp) busyRef.current = true;
    else if (!innerBusy) busyRef.current = false;
  }, [busyProp, innerBusy]);

  // 開閉時のフォーカス移動と復帰
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      previous?.focus?.();
    };
  }, [open]);

  const handleCancel = useCallback(() => {
    if (busyRef.current) return;
    onCancel();
  }, [onCancel]);

  const handleConfirm = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setInnerBusy(true);
    try {
      await onConfirm();
    } finally {
      busyRef.current = busyProp;
      if (mountedRef.current) setInnerBusy(false);
    }
  }, [onConfirm, busyProp]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      handleCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const isDestructive = variant === "destructive";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-busy={busy}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl border border-slate-200"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            aria-hidden="true"
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0",
              isDestructive ? "text-rose-600" : "text-amber-500",
            )}
          />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-slate-900 break-words">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-sm text-slate-600 break-words">
                {description}
              </div>
            )}
          </div>
        </div>

        {children && <div className="mt-4 text-sm text-slate-700">{children}</div>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-disabled={busy}
            className={cn(
              "inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-bold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500",
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
                : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500",
            )}
          >
            {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
