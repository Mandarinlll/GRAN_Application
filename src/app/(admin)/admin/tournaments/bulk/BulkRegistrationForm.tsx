"use client";

// 大会の一括登録フォーム。共通項目 + （開催日, 種目区分）の行（1〜50）。
// 「プレビュー」(dryRun=true) → 内容確認 → 「確定登録」(dryRun=false)。何も確定するまで保存されない。

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const MAX_ROWS = 50;

const CATEGORY_OPTIONS = [
  { value: "SINGLES", label: "シングルス" },
  { value: "DOUBLES", label: "ダブルス" },
  { value: "MEN_TEAM", label: "男子団体戦" },
  { value: "WOMEN_TEAM", label: "女子団体戦" },
  { value: "MIX_TEAM", label: "ミックス団体戦" },
] as const;
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

const TIERS = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];
const SURFACES = [
  { value: "HARD", label: "ハード" },
  { value: "CLAY", label: "クレー" },
  { value: "ARTIFICIAL_GRASS", label: "人工芝" },
  { value: "OTHER", label: "その他" },
];
const GENDERS = [
  { value: "MEN", label: "男子" },
  { value: "WOMEN", label: "女子" },
  { value: "MIXED", label: "ミックス" },
];

interface CommonState {
  title: string;
  venue: string;
  tier: string;
  capacity: string;
  entryFee: string;
  startTime: string;
  endTime: string;
  entryStartAt: string;
  entryEndAt: string;
  description: string;
  prize: string;
  courtInfo: string;
  teamSizeMin: string;
  teamSizeMax: string;
  alertThreshold: string;
  surface: string;
  genderDivision: string;
  seriesId: string;
}

interface RowState {
  key: number;
  eventDate: string;
  category: string;
  title: string;
}

interface PreviewRowDto {
  rowNumber: number;
  input: { title: string; eventDate: string; category: string };
}

type Errors = Record<string, string>;

const INITIAL_COMMON: CommonState = {
  title: "",
  venue: "",
  tier: "",
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
  genderDivision: "",
  seriesId: "",
};

const inputCls =
  "w-full min-h-[44px] rounded-lg border bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
const cardCls = "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-4 sm:p-6";

function borderFor(err?: string) {
  return err ? "border-rose-500" : "border-slate-200 dark:border-slate-700";
}

function Field({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
        {required && <span className="ml-1 text-rose-600 dark:text-rose-500">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-[13px] text-rose-600 dark:text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}

export function BulkRegistrationForm() {
  const [common, setCommon] = useState<CommonState>(INITIAL_COMMON);
  const [rows, setRows] = useState<RowState[]>([{ key: 1, eventDate: "", category: "SINGLES", title: "" }]);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRowDto[] | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const busyRef = useRef(false);
  const nextKey = useRef(2);
  const closeToast = useCallback(() => setToast(null), []);

  const invalidate = () => {
    setPreview(null);
    setErrors({});
    setFormError(null);
  };

  const setC = (name: keyof CommonState, value: string) => {
    setCommon((c) => ({ ...c, [name]: value }));
    invalidate();
  };

  const updateRow = (key: number, patch: Partial<RowState>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    invalidate();
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    const last = rows[rows.length - 1];
    setRows((rs) => [...rs, { key: nextKey.current++, eventDate: "", category: last?.category ?? "SINGLES", title: "" }]);
    invalidate();
  };

  const removeRow = (key: number) => {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.key !== key)));
    invalidate();
  };

  const submit = async (dryRun: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    setFormError(null);

    if (rows.length < 1 || rows.length > MAX_ROWS) {
      setFormError(`登録できる組み合わせは 1 件以上 ${MAX_ROWS} 件以下です。`);
      busyRef.current = false;
      setBusy(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.set("common", JSON.stringify(common));
      fd.set(
        "rows",
        JSON.stringify(rows.map((r) => ({ eventDate: r.eventDate, category: r.category, title: r.title }))),
      );
      fd.set("dryRun", dryRun ? "true" : "false");
      if (file) fd.set("file", file);

      const res = await fetch("/api/admin/tournaments/bulk", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: Errors;
        rows?: PreviewRowDto[];
        ids?: string[];
      } | null;

      if (!res.ok || !body?.ok) {
        const fe = body?.fieldErrors ?? {};
        setErrors(fe);
        setPreview(null);
        setFormError(body?.message ?? "処理に失敗しました。時間をおいて再度お試しください。");
        setToast({ message: "入力内容を確認してください。", type: "error" });
        return;
      }

      if (dryRun) {
        setPreview(body.rows ?? []);
      } else {
        const count = body.ids?.length ?? 0;
        setCreatedCount(count);
        setPreview(null);
        setToast({ message: `${count} 件の大会を登録しました。`, type: "success" });
      }
    } catch {
      setFormError("通信に失敗しました。時間をおいて再度お試しください。");
      setToast({ message: "通信に失敗しました。", type: "error" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const commonErr = (name: string) => errors[`common.${name}`] ?? errors[name];

  const text = (name: keyof CommonState, label: string, opts?: { required?: boolean; type?: string; inputMode?: "numeric"; wide?: boolean }) => (
    <div className={opts?.wide ? "sm:col-span-2" : undefined}>
      <Field label={label} required={opts?.required} error={commonErr(name)} htmlFor={`c-${name}`}>
        <input
          id={`c-${name}`}
          type={opts?.type ?? "text"}
          inputMode={opts?.inputMode}
          value={common[name]}
          onChange={(e) => setC(name, e.target.value)}
          aria-invalid={!!commonErr(name)}
          aria-describedby={commonErr(name) ? `c-${name}-error` : undefined}
          className={cn(inputCls, borderFor(commonErr(name)), opts?.type && opts.type !== "text" ? "tabular-nums" : "")}
        />
      </Field>
    </div>
  );

  const select = (name: keyof CommonState, label: string, options: ReadonlyArray<{ value: string; label: string }>, required?: boolean) => (
    <Field label={label} required={required} error={commonErr(name)} htmlFor={`c-${name}`}>
      <select
        id={`c-${name}`}
        value={common[name]}
        onChange={(e) => setC(name, e.target.value)}
        aria-invalid={!!commonErr(name)}
        className={cn(inputCls, borderFor(commonErr(name)))}
      >
        <option value="">{required ? "選択してください" : "指定なし"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  const rowErrorList = Object.entries(errors)
    .filter(([k]) => k.startsWith("rows"))
    .sort(([a], [b]) => {
      const na = Number(/^rows\.(\d+)/.exec(a)?.[1] ?? -1);
      const nb = Number(/^rows\.(\d+)/.exec(b)?.[1] ?? -1);
      return na - nb;
    });
  const commonErrorCount = Object.keys(errors).filter((k) => k.startsWith("common.")).length;

  if (createdCount !== null) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-24">
        <div className={cn(cardCls, "space-y-4")} role="status">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            <h1 className="text-xl sm:text-2xl font-bold">一括登録が完了しました</h1>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-bold tabular-nums">{createdCount}</span> 件の大会を下書き（DRAFT）として登録しました。
          </p>
          <Link
            href="/admin/tournaments"
            className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            大会一覧へ
          </Link>
        </div>
        <Toast toast={toast} onClose={closeToast} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="space-y-2">
        <Link
          href="/admin/tournaments"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          大会一覧に戻る
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">大会の一括登録</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          共通項目と（開催日、種目区分）の組み合わせを入力すると、組み合わせごとに 1 件ずつ下書きの大会を登録します（1〜{MAX_ROWS} 件）。
        </p>
      </div>

      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      {(rowErrorList.length > 0 || commonErrorCount > 0) && (
        <div role="alert" className={cn(cardCls, "border-rose-200 dark:border-rose-900 space-y-2")}>
          <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">エラー内容</h2>
          <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-200">
            {commonErrorCount > 0 && <li>共通項目に入力エラーがあります。</li>}
            {rowErrorList.map(([k, msg]) => (
              <li key={k} className="tabular-nums">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className={cn(cardCls, "space-y-4")} aria-labelledby="common-heading">
        <h2 id="common-heading" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          共通項目
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("title", "大会名（共通）", { required: true, wide: true })}
          {text("venue", "会場", { required: true, wide: true })}
          {select("tier", "募集階級", TIERS.map((t) => ({ value: t, label: t })), true)}
          {text("capacity", "定員", { required: true, inputMode: "numeric" })}
          {text("entryFee", "参加費（円）", { required: true, inputMode: "numeric" })}
          {text("startTime", "開始時刻", { required: true, type: "time" })}
          {text("endTime", "終了時刻", { type: "time" })}
          {text("entryStartAt", "受付開始", { required: true, type: "datetime-local" })}
          {text("entryEndAt", "受付締切", { required: true, type: "datetime-local" })}
          {select("surface", "サーフェス", SURFACES)}
          {select("genderDivision", "性別区分", GENDERS)}
          {text("teamSizeMin", "チーム最低人数", { inputMode: "numeric" })}
          {text("teamSizeMax", "チーム最大人数", { inputMode: "numeric" })}
          {text("alertThreshold", "アラート閾値", { inputMode: "numeric" })}
          {text("seriesId", "シリーズID")}
          {text("prize", "景品", { wide: true })}
          {text("courtInfo", "コート情報", { wide: true })}
          <div className="sm:col-span-2">
            <Field label="大会説明" error={commonErr("description")} htmlFor="c-description">
              <textarea
                id="c-description"
                rows={3}
                value={common.description}
                onChange={(e) => setC("description", e.target.value)}
                className={cn(inputCls, "py-2", borderFor(commonErr("description")))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="要項画像（全大会に共通で設定・任意）" error={errors["file"] ?? errors["image"]} htmlFor="c-file">
              <input
                id="c-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  invalidate();
                }}
                className="block w-full min-h-[44px] text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:min-h-[44px] file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-4 file:text-sm file:font-medium"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className={cn(cardCls, "space-y-4")} aria-labelledby="rows-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="rows-heading" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            開催日・種目区分（<span className="tabular-nums">{rows.length}</span> / {MAX_ROWS} 件）
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={busy || rows.length >= MAX_ROWS}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            行を追加
          </Button>
        </div>
        {errors["rows"] && (
          <p role="alert" className="text-[13px] text-rose-600 dark:text-rose-500">
            {errors["rows"]}
          </p>
        )}
        <ul className="space-y-3">
          {rows.map((row, i) => {
            const dErr = errors[`rows.${i}.eventDate`];
            const cErr = errors[`rows.${i}.category`];
            const tErr = errors[`rows.${i}.title`];
            return (
              <li
                key={row.key}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 grid gap-3 sm:grid-cols-[2.5rem_1fr_1fr_1.4fr_auto] sm:items-start"
              >
                <span className="text-sm font-bold tabular-nums text-slate-600 dark:text-slate-400 sm:pt-3">{i + 1}</span>
                <Field label="開催日" required error={dErr} htmlFor={`r-${row.key}-date`}>
                  <input
                    id={`r-${row.key}-date`}
                    type="date"
                    value={row.eventDate}
                    onChange={(e) => updateRow(row.key, { eventDate: e.target.value })}
                    aria-invalid={!!dErr}
                    className={cn(inputCls, "tabular-nums", borderFor(dErr))}
                  />
                </Field>
                <Field label="種目区分" required error={cErr} htmlFor={`r-${row.key}-cat`}>
                  <select
                    id={`r-${row.key}-cat`}
                    value={row.category}
                    onChange={(e) => updateRow(row.key, { category: e.target.value })}
                    aria-invalid={!!cErr}
                    className={cn(inputCls, borderFor(cErr))}
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="大会名（任意・共通名を上書き）" error={tErr} htmlFor={`r-${row.key}-title`}>
                  <input
                    id={`r-${row.key}-title`}
                    type="text"
                    value={row.title}
                    onChange={(e) => updateRow(row.key, { title: e.target.value })}
                    aria-invalid={!!tErr}
                    className={cn(inputCls, borderFor(tErr))}
                  />
                </Field>
                <div className="sm:pt-7">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.key)}
                    disabled={busy || rows.length <= 1}
                    aria-label={`${i + 1} 行目を削除`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {preview && (
        <section className={cn(cardCls, "space-y-4")} aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            プレビュー
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-bold tabular-nums">{preview.length}</span> 件の大会が作成されます。内容を確認して確定してください。確定するまで登録されません。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-600 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">行</th>
                  <th className="py-2 pr-3 font-medium">開催日</th>
                  <th className="py-2 pr-3 font-medium">種目区分</th>
                  <th className="py-2 font-medium">大会名</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.rowNumber} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 tabular-nums">{p.rowNumber}</td>
                    <td className="py-2 pr-3 tabular-nums">{p.input.eventDate}</td>
                    <td className="py-2 pr-3">{CATEGORY_LABEL[p.input.category] ?? p.input.category}</td>
                    <td className="py-2">{p.input.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => submit(true)} disabled={busy} isLoading={busy && !preview}>
          <Eye className="mr-1.5 h-4 w-4" aria-hidden />
          プレビュー
        </Button>
        {preview && (
          <Button type="button" onClick={() => submit(false)} disabled={busy} isLoading={busy}>
            {preview.length} 件を確定登録
          </Button>
        )}
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
