import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/session";
import { getSettings } from "@/features/settings/server/settingsRepository";
import {
  DEFAULT_SETTINGS,
  colorModeAttr,
  fontSizeAttr,
} from "@/features/settings/types/settings";
import { ThemeSync } from "@/features/settings/components/ThemeSync";

// layout.tsx は「全ページ共通の一番外側の枠」。
// <html> と <body> はここだけに書く。各ページ(page.tsx)の中身は children として差し込まれる。
export const metadata: Metadata = {
  title: "GRAN TENNIS",
  description: "テニス大会GRAN 運営アプリ",
};

// 初回描画前にダーク判定してちらつきを防ぐ静的スクリプト（固定文字列のみ・外部入力なし）。
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var t=d.dataset.theme;var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)d.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ログイン中ならユーザーのアプリ設定（文字サイズ/カラーモード）を反映する。
  const session = await getSession();
  const settings = session ? getSettings(session.sub) : DEFAULT_SETTINGS;

  return (
    <html
      lang="ja"
      data-font={fontSizeAttr(settings.fontSize)}
      data-theme={colorModeAttr(settings.colorMode)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* 元 home.html の <body class="..."> をそのまま移植（class → className） */}
      <body className="bg-slate-50 text-slate-900 min-h-screen pb-20 sm:pb-8 antialiased">
        <ThemeSync fontSize={settings.fontSize} colorMode={settings.colorMode} />
        {children}
      </body>
    </html>
  );
}
