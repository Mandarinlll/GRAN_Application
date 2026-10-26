// トースト通知（ui-design-system.md 7.3 準拠）。
// モバイルは下部ナビ直上・画面中央、PC は右下に表示する。
"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error";

export interface ToastState {
  message: string;
  type: ToastType;
}

export function Toast({
  toast,
  onClose,
  durationMs = 3200,
}: {
  toast: ToastState | null;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs, onClose]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-[80] transition-all duration-300",
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom)+12px)] inset-x-4 max-w-sm mx-auto",
        "md:bottom-6 md:right-6 md:left-auto md:mx-0",
        "flex items-center gap-2.5 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg border border-slate-700",
      )}
    >
      {toast.type === "success" ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      )}
      <span className="font-medium text-xs leading-snug">{toast.message}</span>
    </div>
  );
}
