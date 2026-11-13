import type { ReactNode } from "react";

/** 連続失敗がこの回数以上で追加メッセージを表示する（要件10.4） */
export const REPEATED_FAILURE_THRESHOLD = 3;

export function Skeleton({ label = "読み込み中", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-5 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorPanel({
  message = "データの取得に失敗しました。",
  onRetry,
  consecutiveFailures = 0,
}: {
  message?: string;
  onRetry: () => void;
  consecutiveFailures?: number;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-slate-900 dark:border-red-900 dark:bg-slate-900 dark:text-slate-100"
    >
      <p className="text-sm font-bold">
        <span aria-hidden="true">⚠ </span>
        {message}
      </p>
      {consecutiveFailures >= REPEATED_FAILURE_THRESHOLD && (
        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
          時間をおいて再度お試しください
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-[44px] rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:text-slate-900 dark:hover:bg-emerald-400 dark:focus-visible:ring-emerald-500"
      >
        再試行
      </button>
    </div>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <p className="text-sm">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
