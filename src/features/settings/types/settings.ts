// アプリ設定（通知・文字サイズ・カラーモード）の型と既定値。

export type FontSize = "SMALL" | "MEDIUM" | "LARGE";
export type ColorMode = "LIGHT" | "DARK" | "SYSTEM";

export const FONT_SIZES: readonly FontSize[] = ["SMALL", "MEDIUM", "LARGE"];
export const COLOR_MODES: readonly ColorMode[] = ["LIGHT", "DARK", "SYSTEM"];

export interface AppSettings {
  notifyReminder: boolean; // 開催7日前リマインド
  notifyMemberAssign: boolean; // 出場メンバー指定の依頼
  fontSize: FontSize;
  colorMode: ColorMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notifyReminder: true,
  notifyMemberAssign: true,
  fontSize: "MEDIUM",
  colorMode: "SYSTEM",
};

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  SMALL: "小",
  MEDIUM: "標準",
  LARGE: "大",
};

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  LIGHT: "ライト",
  DARK: "ダーク",
  SYSTEM: "端末に合わせる",
};

// html 要素へ付与する data 属性値（globals.css と対応）。
export function fontSizeAttr(size: FontSize): string {
  return size.toLowerCase();
}
export function colorModeAttr(mode: ColorMode): string {
  return mode.toLowerCase();
}
