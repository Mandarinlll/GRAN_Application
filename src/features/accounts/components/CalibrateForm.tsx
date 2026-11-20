// 初期レベル査定フォーム。
// - レンジ外の値は警告を出し、入力が変わっていない再送信のときだけ confirmOutOfRange: true を送る
// - 入力を変えると確認状態は破棄される（変更後の値は再度警告から始まる）
// - エラー時は入力値を保持する
"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Toast, type ToastState } from "@/components/ui/Toast";

export interface CalibrateFormProps {
  userId: string;
  declaredClass: string | null;
  currentLevel: number;
  range: readonly [number, number] | null;
}

interface Warning {
  value: string;
  range: [number, number];
}

const TIMEOUT_MS = 30_000;

export function CalibrateForm({ userId, declaredClass, currentLevel, range }: CalibrateFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentLevel));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [warning, setWarning] = useState<Warning | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const inFlight = useRef(false);

  const confirming = warning !== null && warning.value === value.trim();

  function onChange(next: string) {
    setValue(next);
    setFieldError(null);
    // 入力が変わったら確認状態をリセットする
    if (warning && warning.value !== next.trim()) setWarning(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFieldError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const submitted = value.trim();
    try {
      const res = await fetch(`/api/admin/users/${userId}/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granLevel: submitted, confirmOutOfRange: confirming }),
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
        if (data.needsConfirmation === true && Array.isArray(data.range)) {
          const [min, max] = data.range as [number, number];
          setWarning({ value: submitted, range: [min, max] });
          return;
        }
        setWarning(null);
        setToast({ type: "success", message: `Gran_Levelを ${submitted} に設定しました` });
        router.refresh();
        return;
      }

      setWarning(null);
      const fieldErrors = data.fieldErrors as Record<string, unknown> | undefined;
      if (typeof fieldErrors?.granLevel === "string") {
        setFieldError(fieldErrors.granLevel);
      } else {
        const msg = typeof data.message === "string" ? data.message : "初期レベルを査定できませんでした。";
        setToast({ type: "error", message: msg });
      }
    } catch {
      setToast({
        type: "error",
        message: controller.signal.aborted
          ? "応答がありませんでした。時間をおいて再度お試しください。"
          : "通信に失敗しました。時間をおいて再度お試しください。",
      });
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setBusy(false);
    }
  }

  const errorId = "calibrate-error";
  const warnId = "calibrate-warning";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={busy}>
      <div className="space-y-1.5">
        <label htmlFor="granLevel" className="block text-sm font-medium text-slate-800">
          新しい Gran_Level（100〜999 の整数）
        </label>
        <input
          id="granLevel"
          name="granLevel"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={[fieldError ? errorId : null, warning ? warnId : null].filter(Boolean).join(" ") || undefined}
          className="block min-h-[44px] w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 text-sm tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {fieldError && (
          <p id={errorId} role="alert" className="text-[13px] text-rose-600">
            {fieldError}
          </p>
        )}
      </div>

      {confirming && warning && (
        <div
          id={warnId}
          role="alert"
          className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            入力した値 {warning.value} は申告階級{declaredClass ? `（${declaredClass}）` : ""}の査定レンジ（
            <span className="tabular-nums">
              {warning.range[0]}〜{warning.range[1]}
            </span>
            ）の範囲外です。このまま確定する場合は、もう一度「範囲外で確定する」を押してください。
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "送信中…" : confirming ? "範囲外で確定する" : "査定を確定する"}
      </button>
      {range === null && (
        <p className="text-[13px] text-slate-600">申告階級が未設定のため、レンジ判定は行われません。</p>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} durationMs={4000} />
    </form>
  );
}
