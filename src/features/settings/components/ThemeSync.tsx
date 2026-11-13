// サーバーで確定した設定を <html> に反映し、「端末に合わせる」時はOS設定の変更にも追従する。
"use client";

import { useEffect } from "react";
import { applyTheme } from "@/features/settings/utils/applyTheme";
import type { ColorMode, FontSize } from "@/features/settings/types/settings";

export function ThemeSync({
  fontSize,
  colorMode,
}: {
  fontSize: FontSize;
  colorMode: ColorMode;
}) {
  useEffect(() => {
    applyTheme({ fontSize, colorMode });
    if (colorMode !== "SYSTEM") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme({ fontSize, colorMode });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [fontSize, colorMode]);
  return null;
}
