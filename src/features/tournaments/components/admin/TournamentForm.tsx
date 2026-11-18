// 大会の登録・コピー作成・編集で共通のフォーム（Requirement 3, 4, 5, 8, 12）。
// - 必須項目の表示、項目別エラー、エラー時も入力値を保持
// - 要項画像のプレビュー（URL.createObjectURL）
// - 参加費変更時（確定エントリーあり）は確認ダイアログ
// - 送信は multipart。busy は ref で同期的に判定し二重送信を防ぐ
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { CATEGORY_LABEL, TIER_LABEL } from "@/features/tournaments/types/tournament";
import { needsFeeConfirmation } from "@/features/tournaments/utils/alerts";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const SURFACE_LABEL: Record<string, string> = {
  HARD: "ハード",
  CLAY: "クレー",
  ARTIFICIAL_GRASS: "砂入り人工芝",
  OTHER: "その他",
};
const GENDER_LABEL: Record<string, string> = {
  MEN: "男子",
  WOMEN: "女子",
  MIXED: "ミックス",
};

// フォームの入力値（すべて文字列で保持し、そのまま multipart で送る）
export interface TournamentFormValues {
  title: string;
  eventDate: string;
  category: string;
  tier: string;
  venue: string;
  capacity: string;
  entryFee: string;
  startTime: string;
  endTime: string;
  entryStartAt: string; // datetime-local（YYYY-MM-DDTHH:mm）
  entryEndAt: string;
  description: string;
  prize: string;
  courtInfo: string;
  teamSizeMin: string;
  teamSizeMax: string;
  alertThreshold: string;
  surface: string;
  seriesId: string;
  genderDivision: string;
}

export const EMPTY_FORM_VALUES: TournamentFormValues = {
  title: "",
  eventDate: "",
  category: "",
  tier: "",
  venue: "",
  capacity: "",
  entryFee: "",
  startTime: "",
  endTime: "",
  entryStartAt: "",
  entryEndAt: "",
  description: "",
  prize: "",
  courtInfo: "",
  teamSizeMin: "",
  teamSizeMax: "",
  alertThreshold: "",
  surface: "",
  seriesId: "",
  genderDivision: "",
};

type FieldKey = keyof TournamentFormValues;
type Errors = Partial<Record<FieldKey | "image" | "form", string>>;

export interface TournamentFormProps {
  mode: "create" | "edit";
  initialValues: TournamentFormValues;
  /** 編集時の対象 ID */
  tournamentId?: string;
  /** 編集時の楽観ロック用 updated_at */
  expectedUpdatedAt?: string;
  /** コピー作成時のコピー元 ID */
  copyFromId?: string;
  /** 既存（またはコピー元）の画像 URL。管理対象外のコピー元は空にして渡す */
  existingImageUrl?: string | null;
  /** 編集時の確定エントリー数（参加費変更の確認要否に使う） */
  confirmedCount?: number;
  /** FINISHED / CANCELLED は開催日・定員・参加費を変更できない */
  lockedFields?: boolean;
  cancelHref: string;
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">必須</span>
        ) : (
          <span className="text-[10px] font-normal text-slate-400">任意</span>
        )}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
    error ? "border-rose-400" : "border-slate-300",
  );

export function TournamentForm({
  mode,
  initialValues,
  tournamentId,
  expectedUpdatedAt,
  copyFromId,
  existingImageUrl = null,
  confirmedCount = 0,
  lockedFields = false,
  cancelHref,
}: TournamentFormProps) {
  const router = useRouter();
  const uid = useId();
  const idOf = (k: string) => `${uid}-${k}`;

  const [values, setValues] = useState<TournamentFormValues>(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const busyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    [],
  );

  const set = (key: FieldKey) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (!IMAGE_TYPES.includes(f.type)) {
      setFile(null);
      e.target.value = "";
      setErrors((prev) => ({ ...prev, image: "PNG、JPEG、WebP の画像を選択してください" }));
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setFile(null);
      e.target.value = "";
      setErrors((prev) => ({ ...prev, image: "画像は 5MB 以下にしてください" }));
      return;
    }
    setErrors((prev) => ({ ...prev, image: undefined }));
    setFile(f);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    (Object.keys(values) as FieldKey[]).forEach((k) => {
      fd.set(k, values[k]);
    });
    if (mode === "edit" && expectedUpdatedAt) fd.set("expectedUpdatedAt", expectedUpdatedAt);
    if (mode === "create" && copyFromId) fd.set("copyFromId", copyFromId);
    if (file) fd.set("file", file);
    return fd;
  }

  async function doSubmit() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    let succeeded = false;
    try {
      const url = mode === "edit" ? `/api/admin/tournaments/${tournamentId}` : "/api/admin/tournaments";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        body: buildFormData(),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        message?: string;
        warning?: string;
        fieldErrors?: Errors;
      };
      if (res.ok && body.ok !== false) {
        succeeded = true;
        const nextId = mode === "edit" ? tournamentId : body.id;
        setToast({
          type: "success",
          message: [body.message ?? "保存しました。", body.warning].filter(Boolean).join(" "),
        });
        redirectTimer.current = setTimeout(() => {
          router.push(nextId ? `/admin/tournaments/${nextId}` : "/admin/tournaments");
          router.refresh();
        }, 1200);
        return;
      }
      const fallback =
        res.status === 403
          ? "この操作を行う権限がありません。"
          : res.status === 401
            ? "ログインが必要です。"
            : "保存に失敗しました。";
      const fe = body.fieldErrors ?? {};
      setErrors(fe);
      const message = body.message ?? fallback;
      // 項目別エラーが無い場合のみフォーム全体のエラーとして出す
      if (Object.keys(fe).length === 0) setErrors({ form: message });
      setToast({ type: "error", message: Object.keys(fe).length > 0 ? "入力内容を確認してください。" : message });
    } catch {
      setErrors({ form: "通信に失敗しました。時間をおいて再度お試しください。" });
      setToast({ type: "error", message: "通信に失敗しました。" });
    } finally {
      if (!succeeded) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    if (mode === "edit") {
      const oldFee = Number(initialValues.entryFee);
      const newFee = Number(values.entryFee);
      if (
        Number.isFinite(oldFee) &&
        Number.isFinite(newFee) &&
        values.entryFee.trim() !== "" &&
        needsFeeConfirmation(oldFee, newFee, confirmedCount)
      ) {
        setFeeDialogOpen(true);
        return;
      }
    }
    void doSubmit();
  }

  const err = (k: FieldKey) => errors[k];
  const aria = (k: FieldKey) => ({
    "aria-invalid": err(k) ? (true as const) : undefined,
    "aria-describedby": err(k) ? `${idOf(k)}-error` : undefined,
  });

  const shownImage = previewUrl ?? existingImageUrl;

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <p className="text-xs text-slate-500">
          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">必須</span>
          の項目は必ず入力してください。
        </p>

        {errors.form ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errors.form}
          </p>
        ) : null}

        {lockedFields ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            終了・中止の大会は、開催日・定員・参加費を変更できません。
          </p>
        ) : null}

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">基本情報</h2>

          <Field id={idOf("title")} label="大会名" required error={err("title")} hint="100 文字以内">
            <input id={idOf("title")} type="text" value={values.title} onChange={set("title")} className={inputClass(err("title"))} {...aria("title")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={idOf("category")} label="種目区分" required error={err("category")}>
              <select id={idOf("category")} value={values.category} onChange={set("category")} className={inputClass(err("category"))} {...aria("category")}>
                <option value="">選択してください</option>
                {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={idOf("tier")} label="募集階級" required error={err("tier")}>
              <select id={idOf("tier")} value={values.tier} onChange={set("tier")} className={inputClass(err("tier"))} {...aria("tier")}>
                <option value="">選択してください</option>
                {Object.entries(TIER_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field id={idOf("venue")} label="会場" required error={err("venue")}>
            <input id={idOf("venue")} type="text" value={values.venue} onChange={set("venue")} className={inputClass(err("venue"))} {...aria("venue")} />
          </Field>

          <Field id={idOf("courtInfo")} label="コート情報" error={err("courtInfo")}>
            <input id={idOf("courtInfo")} type="text" value={values.courtInfo} onChange={set("courtInfo")} className={inputClass(err("courtInfo"))} {...aria("courtInfo")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={idOf("surface")} label="サーフェス" error={err("surface")}>
              <select id={idOf("surface")} value={values.surface} onChange={set("surface")} className={inputClass(err("surface"))} {...aria("surface")}>
                <option value="">未設定</option>
                {Object.entries(SURFACE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={idOf("genderDivision")} label="性別区分" error={err("genderDivision")}>
              <select id={idOf("genderDivision")} value={values.genderDivision} onChange={set("genderDivision")} className={inputClass(err("genderDivision"))} {...aria("genderDivision")}>
                <option value="">未設定</option>
                {Object.entries(GENDER_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field id={idOf("seriesId")} label="シリーズ ID" error={err("seriesId")}>
            <input id={idOf("seriesId")} type="text" value={values.seriesId} onChange={set("seriesId")} className={inputClass(err("seriesId"))} {...aria("seriesId")} />
          </Field>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">日時・受付</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={idOf("eventDate")} label="開催日" required error={err("eventDate")}>
              <input id={idOf("eventDate")} type="date" value={values.eventDate} onChange={set("eventDate")} disabled={lockedFields} className={cn(inputClass(err("eventDate")), "tabular-nums")} {...aria("eventDate")} />
            </Field>
            <Field id={idOf("startTime")} label="開始時刻" required error={err("startTime")}>
              <input id={idOf("startTime")} type="time" value={values.startTime} onChange={set("startTime")} className={cn(inputClass(err("startTime")), "tabular-nums")} {...aria("startTime")} />
            </Field>
            <Field id={idOf("endTime")} label="終了時刻" error={err("endTime")}>
              <input id={idOf("endTime")} type="time" value={values.endTime} onChange={set("endTime")} className={cn(inputClass(err("endTime")), "tabular-nums")} {...aria("endTime")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={idOf("entryStartAt")} label="受付開始" required error={err("entryStartAt")}>
              <input id={idOf("entryStartAt")} type="datetime-local" value={values.entryStartAt} onChange={set("entryStartAt")} className={cn(inputClass(err("entryStartAt")), "tabular-nums")} {...aria("entryStartAt")} />
            </Field>
            <Field id={idOf("entryEndAt")} label="受付締切" required error={err("entryEndAt")}>
              <input id={idOf("entryEndAt")} type="datetime-local" value={values.entryEndAt} onChange={set("entryEndAt")} className={cn(inputClass(err("entryEndAt")), "tabular-nums")} {...aria("entryEndAt")} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">定員・参加費</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={idOf("capacity")} label="定員" required error={err("capacity")} hint="1〜9,999">
              <input id={idOf("capacity")} type="number" inputMode="numeric" min={1} max={9999} value={values.capacity} onChange={set("capacity")} disabled={lockedFields} className={cn(inputClass(err("capacity")), "tabular-nums")} {...aria("capacity")} />
            </Field>
            <Field id={idOf("entryFee")} label="参加費（円）" required error={err("entryFee")} hint="0〜999,999">
              <input id={idOf("entryFee")} type="number" inputMode="numeric" min={0} max={999999} value={values.entryFee} onChange={set("entryFee")} disabled={lockedFields} className={cn(inputClass(err("entryFee")), "tabular-nums")} {...aria("entryFee")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={idOf("teamSizeMin")} label="チーム最少人数" error={err("teamSizeMin")}>
              <input id={idOf("teamSizeMin")} type="number" inputMode="numeric" min={1} value={values.teamSizeMin} onChange={set("teamSizeMin")} className={cn(inputClass(err("teamSizeMin")), "tabular-nums")} {...aria("teamSizeMin")} />
            </Field>
            <Field id={idOf("teamSizeMax")} label="チーム最大人数" error={err("teamSizeMax")}>
              <input id={idOf("teamSizeMax")} type="number" inputMode="numeric" min={1} value={values.teamSizeMax} onChange={set("teamSizeMax")} className={cn(inputClass(err("teamSizeMax")), "tabular-nums")} {...aria("teamSizeMax")} />
            </Field>
            <Field id={idOf("alertThreshold")} label="アラート閾値" error={err("alertThreshold")} hint="0〜定員">
              <input id={idOf("alertThreshold")} type="number" inputMode="numeric" min={0} value={values.alertThreshold} onChange={set("alertThreshold")} className={cn(inputClass(err("alertThreshold")), "tabular-nums")} {...aria("alertThreshold")} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900">詳細・要項画像</h2>
          <Field id={idOf("description")} label="大会概要" error={err("description")}>
            <textarea id={idOf("description")} rows={5} value={values.description} onChange={set("description")} className={cn(inputClass(err("description")), "h-auto py-2")} {...aria("description")} />
          </Field>
          <Field id={idOf("prize")} label="景品" error={err("prize")} hint="200 文字以内">
            <input id={idOf("prize")} type="text" value={values.prize} onChange={set("prize")} className={inputClass(err("prize"))} {...aria("prize")} />
          </Field>

          <div className="space-y-2">
            <label htmlFor={idOf("image")} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              要項画像
              <span className="text-[10px] font-normal text-slate-400">任意</span>
            </label>
            <p className="text-xs text-slate-500">PNG、JPEG、WebP（5MB 以下）。</p>
            {shownImage ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shownImage} alt="要項画像のプレビュー" className="max-h-64 max-w-full rounded-lg border border-slate-200 object-contain" />
                {file ? (
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label="選択した画像を取り消す"
                    className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div>
              <label
                htmlFor={idOf("image")}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
              >
                <ImagePlus aria-hidden="true" className="h-4 w-4" />
                {shownImage ? "画像を差し替える" : "画像を選択"}
              </label>
              <input
                ref={fileInputRef}
                id={idOf("image")}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onFileChange}
                className="sr-only"
              />
            </div>
            {errors.image ? (
              <p role="alert" className="text-xs text-rose-700">
                {errors.image}
              </p>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href={cancelHref}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={busy}
            aria-disabled={busy}
            className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {busy ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "edit" ? "更新する" : "登録する"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={feeDialogOpen}
        title="参加費を変更しますか？"
        description={`確定済みのエントリーが ${confirmedCount} 件あります。参加費を ${Number(initialValues.entryFee).toLocaleString("ja-JP")} 円から ${Number(values.entryFee).toLocaleString("ja-JP")} 円へ変更します。`}
        confirmLabel="変更して保存"
        onCancel={() => setFeeDialogOpen(false)}
        onConfirm={async () => {
          setFeeDialogOpen(false);
          await doSubmit();
        }}
      >
        <p>内容を確認のうえ保存してください。</p>
      </ConfirmDialog>

      <Toast toast={toast} onClose={() => setToast(null)} durationMs={4000} />
    </>
  );
}
