// 文字サイズ / カラーモードを <html> へ反映するクライアント側の補助関数。
// 反映先: data-font / data-theme 属性と、ダーク時の "dark" クラス（globals.css が参照）。
import {
  colorModeAttr,
  fontSizeAttr,
  type ColorMode,
  type FontSize,
} from "@/features/settings/types/settings";

export function isDarkActive(mode: ColorMode): boolean {
  if (mode === "DARK") return true;
  if (mode === "LIGHT") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(settings: {
  fontSize: FontSize;
  colorMode: ColorMode;
}): void {
  const root = document.documentElement;
  root.dataset.font = fontSizeAttr(settings.fontSize);
  root.dataset.theme = colorModeAttr(settings.colorMode);
  root.classList.toggle("dark", isDarkActive(settings.colorMode));
}
