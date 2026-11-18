// アカウント作成フォーム。入力値はエラー時も保持し、成功時の Initial_Password は state にだけ持つ（1 回のみ表示）。
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, UserPlus } from "lucide-react";
import { InitialPasswordNotice } from "./InitialPasswordNotice";

const FIELD_KEYS = [
  "email",
  "realName",
  "kanaName",
  "nickname",
  "gender",
  "birthDate",
  "phoneNumber",
  "declaredClass",
  "granLevel",
  "role",
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];
type Values = Record<FieldKey, string>;

const INITIAL_VALUES: Values = {
  email: "",
  realName: "",
  kanaName: "",
  nickname: "",
  gender: "",
  birthDate: "",
  phoneNumber: "",
  declaredClass: "",
  granLevel: "",
  role: "USER",
};

const CLASS_OPTIONS = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"] as const;
const GENDER_OPTIONS = [
  ["MALE", "男性"],
  ["FEMALE", "女性"],
  ["OTHER", "その他"],
] as const;
const ROLE_OPTIONS = [
  ["USER", "一般"],
  ["LEADER", "チーム代表"],
  ["OPERATOR", "運営"],
  ["ADMIN", "管理者"],
] as const;

const TIMEOUT_MS = 30_000;

const inputClass =
  "block min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 aria-[invalid=true]:border-rose-400";

interface Created {
  id: string;
  loginId: string;
  initialPassword: string;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">
            <span aria-hidden="true">* </span>必須
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function CreateUserForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const inFlight = useRef(false);

  function set(key: FieldKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function bind(key: FieldKey, hint?: boolean) {
    const describedBy = [hint ? `f-${key}-hint` : null, errors[key] ? `f-${key}-error` : null]
      .filter(Boolean)
      .join(" ");
    return {
      id: `f-${key}`,
      name: key,
      value: values[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value),
      "aria-invalid": errors[key] ? (true as const) : undefined,
      "aria-describedby": describedBy || undefined,
      className: inputClass,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setErrors({});

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        signal: controller.signal,
      });
      let body: {
        ok?: boolean;
        id?: string;
        loginId?: string;
        initialPassword?: string;
        message?: string;
        fieldErrors?: Record<string, string>;
      } | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (res.ok && body?.ok && body.id && body.initialPassword) {
        setCreated({ id: body.id, loginId: body.loginId ?? "", initialPassword: body.initialPassword });
      } else {
        const fe = { ...(body?.fieldErrors ?? {}) };
        if (!fe.form) {
          // フィールドエラーが無い失敗（権限・DB エラー等）はフォーム全体のエラーとして表示する
          if (Object.keys(fe).length === 0) {
            fe.form = body?.message ?? "アカウントの作成に失敗しました。時間をおいて再度お試しください。";
          }
        }
        setErrors(fe);
      }
    } catch {
      setErrors({
        form: controller.signal.aborted
          ? "通信がタイムアウトしました。作成されたか一覧で確認してから、再度お試しください。"
          : "通信に失敗しました。ネットワークを確認して再度お試しください。",
      });
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          アカウントを作成しました（ユーザーID: <span className="tabular-nums">{created.loginId}</span>）。
        </p>
        <InitialPasswordNotice password={created.initialPassword} title="アカウントを作成しました" />
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/users/${created.id}`}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            詳細を見る
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      {errors.form && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {errors.form}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="f-email" label="メールアドレス" required error={errors.email}>
          <input type="email" autoComplete="off" {...bind("email")} />
        </Field>
        <Field id="f-phoneNumber" label="電話番号" required hint="数字とハイフンのみ、10〜15文字" error={errors.phoneNumber}>
          <input type="tel" inputMode="tel" autoComplete="off" {...bind("phoneNumber", true)} />
        </Field>
        <Field id="f-realName" label="氏名" required hint="40文字以内" error={errors.realName}>
          <input type="text" autoComplete="off" {...bind("realName", true)} />
        </Field>
        <Field id="f-kanaName" label="フリガナ" required hint="40文字以内" error={errors.kanaName}>
          <input type="text" autoComplete="off" {...bind("kanaName", true)} />
        </Field>
        <Field id="f-nickname" label="ニックネーム" required hint="40文字以内" error={errors.nickname}>
          <input type="text" autoComplete="off" {...bind("nickname", true)} />
        </Field>
        <Field id="f-gender" label="性別" error={errors.gender}>
          <select {...bind("gender")}>
            <option value="">未設定</option>
            {GENDER_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="f-birthDate" label="生年月日" error={errors.birthDate}>
          <input type="date" autoComplete="off" {...bind("birthDate")} />
        </Field>
        <Field id="f-declaredClass" label="申告クラス" required error={errors.declaredClass}>
          <select {...bind("declaredClass")}>
            <option value="">選択してください</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="f-granLevel"
          label="Granレベル"
          hint="100〜999の整数。未入力の場合は申告クラスの中央値になり、未査定として登録されます"
          error={errors.granLevel}
        >
          <input type="text" inputMode="numeric" autoComplete="off" {...bind("granLevel", true)} />
        </Field>
        <Field id="f-role" label="権限" error={errors.role}>
          <select {...bind("role")}>
            {ROLE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          {submitting ? "作成中…" : "アカウントを作成"}
        </button>
        <Link
          href="/admin/users"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          一覧へ戻る
        </Link>
      </div>
    </form>
  );
}
