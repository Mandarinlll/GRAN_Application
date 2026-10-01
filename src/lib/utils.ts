// クラス名結合ユーティリティ（ui-design-system.md 2.2 準拠）。
// 条件付きクラスと Tailwind の重複解決（tailwind-merge）をまとめて行う。

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
