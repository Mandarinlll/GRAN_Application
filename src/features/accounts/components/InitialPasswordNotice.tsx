// Initial_Password の 1 回限りの表示。値は親の state にだけ保持し、URL・storage には入れない。
"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

export interface InitialPasswordNoticeProps {
  password: string;
  /** 見出し（例: 「アカウントを作成しました」） */
  title?: string;
  /** 閉じる操作。指定すると「閉じる」ボタンを表示する */
  onDismiss?: () => void;
}

export function InitialPasswordNotice({
  password,
  title = "初期パスワードを発行しました",
  onDismiss,
}: InitialPasswordNoticeProps) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <section
      aria-label="初期パスワード"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-slate-900"
    >
      <div className="flex items-start gap-3">
        <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-[13px] text-slate-700">
            このパスワードは今回しか表示されません。画面を離れる前に控えてください。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              data-testid="initial-password"
              className="select-all break-all rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-base tabular-nums"
            >
              {password}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              {copied === "done" ? (
                <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy aria-hidden="true" className="h-4 w-4" />
              )}
              コピー
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                閉じる
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className="min-h-[1rem] text-xs text-slate-600">
            {copied === "done" && "コピーしました。"}
            {copied === "failed" && "コピーできませんでした。パスワードを選択して手動でコピーしてください。"}
          </p>
        </div>
      </div>
    </section>
  );
}
