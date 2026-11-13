// 設定画面で共通利用するフォーム部品。
import { AlertCircle } from "lucide-react";

export const inputBase =
  "w-full h-11 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 transition";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
      <span>{message}</span>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">{title}</h2>
          {description ? (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
