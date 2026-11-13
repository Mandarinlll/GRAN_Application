// アプリ設定（通知・文字サイズ・カラーモード）。変更するたびに自動保存し、即時に画面へ反映する。
"use client";

import { useRef, useState, useTransition } from "react";
import { Bell, Type, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { saveAppSettingsAction } from "@/features/settings/server/actions";
import { applyTheme } from "@/features/settings/utils/applyTheme";
import {
  COLOR_MODES,
  COLOR_MODE_LABELS,
  FONT_SIZES,
  FONT_SIZE_LABELS,
  type AppSettings,
  type ColorMode,
  type FontSize,
} from "@/features/settings/types/settings";
import { SectionCard } from "@/features/settings/components/fields";

export function AppSettingsForm({ initial }: { initial: AppSettings }) {
  const [settings, setSettings] = useState<AppSettings>(initial);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  // 保存に失敗した時に戻すための直近の保存済み値
  const savedRef = useRef<AppSettings>(initial);

  function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next); // 即時プレビュー
    startTransition(async () => {
      const res = await saveAppSettingsAction(next);
      if (res.ok) {
        savedRef.current = next;
        setToast({ message: "設定を保存しました。", type: "success" });
      } else {
        const prev = savedRef.current;
        setSettings(prev);
        applyTheme(prev);
        setToast({ message: res.message ?? "設定を保存できませんでした。", type: "error" });
      }
    });
  }

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <SectionCard
        title="通知"
        description="通知画面に表示するお知らせの種類を選べます。OFFにした種類は新しく届かなくなります。"
        icon={<Bell className="w-4 h-4" />}
      >
        <ul className="divide-y divide-slate-100">
          <ToggleRow
            id="notifyReminder"
            label="開催7日前のリマインド"
            description="エントリーが確定した大会の開催7日前（9:00）にお知らせします。"
            checked={settings.notifyReminder}
            onChange={(v) => update({ notifyReminder: v })}
          />
          <ToggleRow
            id="notifyMemberAssign"
            label="出場メンバー指定の依頼"
            description="出場メンバーが未定の団体戦・ダブルスがある場合にお知らせします。"
            checked={settings.notifyMemberAssign}
            onChange={(v) => update({ notifyMemberAssign: v })}
          />
        </ul>
      </SectionCard>

      <SectionCard
        title="文字サイズ"
        description="アプリ全体の文字の大きさを変更します。"
        icon={<Type className="w-4 h-4" />}
      >
        <Segmented<FontSize>
          name="fontSize"
          legend="文字サイズ"
          value={settings.fontSize}
          options={FONT_SIZES.map((v) => ({ value: v, label: FONT_SIZE_LABELS[v] }))}
          onChange={(v) => update({ fontSize: v })}
        />
      </SectionCard>

      <SectionCard
        title="カラーモード"
        description="画面の配色を選べます。屋内や夜間はダークモードが見やすくなります。"
        icon={<Palette className="w-4 h-4" />}
      >
        <Segmented<ColorMode>
          name="colorMode"
          legend="カラーモード"
          value={settings.colorMode}
          options={COLOR_MODES.map((v) => ({ value: v, label: COLOR_MODE_LABELS[v] }))}
          onChange={(v) => update({ colorMode: v })}
        />
      </SectionCard>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-bold text-slate-800">
          {label}
        </label>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="shrink-0 min-h-[44px] min-w-[52px] flex items-center justify-center focus-visible:outline-none"
      >
        <span
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:ring-2",
            checked ? "bg-emerald-600" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-6" : "translate-x-1",
            )}
          />
        </span>
        <span className="sr-only">{checked ? "ON" : "OFF"}</span>
      </button>
    </li>
  );
}

function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex items-center justify-center min-h-[44px] px-2 rounded-xl border text-xs font-bold text-center cursor-pointer transition",
                "focus-within:ring-2 focus-within:ring-emerald-500",
                selected
                  ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100",
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
