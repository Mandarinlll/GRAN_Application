// 取得失敗時のエラー表示 + 再取得ボタン（共通 UI・Client）。
// レベル推移 / 出場履歴 / 成績サマリの取得失敗時に利用する
// （Requirement 5.8 / 6.9 / 9.5）。
// 再取得ボタンは 44px 以上の最小タッチターゲットを満たす（Requirement 1.5）。
"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  // エラーの説明テキスト。未指定時は既定文言を表示する。
  message?: string;
  // 再取得ボタン押下時のコールバック。
  onRetry?: () => void;
  // 再取得ボタンのラベル（任意）。
  retryLabel?: string;
  className?: string;
};

export function ErrorRetry({
  message = "データの取得に失敗しました。",
  onRetry,
  retryLabel = "再取得",
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-8 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-rose-700">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            // 44px 以上の最小タッチターゲット。
            "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5",
            "rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white",
            "transition-colors hover:bg-rose-700 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2",
          )}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          <span>{retryLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
