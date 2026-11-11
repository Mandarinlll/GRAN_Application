// マイデータ各リージョン共通の定数・整形関数。

export const CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

export const SECTION_TITLE_CLASS = "text-base font-bold text-slate-900 dark:text-slate-100";

export const NOTE_CLASS = "text-xs text-slate-700 dark:text-slate-300";

export const SECONDARY_BUTTON_CLASS =
  "min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-500";

/** "YYYY-MM-DD HH:mm:ss" → "YYYY/MM/DD HH:mm" */
export function formatDateTime(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
  return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}` : s;
}

/** "YYYY-MM-DD..." → "YYYY/MM/DD" */
export function formatDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : s;
}

export const DELTA_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "text-emerald-700 dark:text-emerald-300",
  down: "text-red-700 dark:text-red-300",
  flat: "text-slate-700 dark:text-slate-300",
};

export const DELTA_ICON: Record<"up" | "down" | "flat", string> = {
  up: "▲",
  down: "▼",
  flat: "",
};

export function tierLabel(tier: string): string {
  return `${tier}級`;
}
