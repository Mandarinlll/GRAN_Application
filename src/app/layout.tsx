import type { Metadata } from "next";
import "./globals.css";

// layout.tsx は「全ページ共通の一番外側の枠」。
// <html> と <body> はここだけに書く。各ページ(page.tsx)の中身は children として差し込まれる。
export const metadata: Metadata = {
  title: "GRAN TENNIS",
  description: "テニス大会GRAN 運営アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      {/* 元 home.html の <body class="..."> をそのまま移植（class → className） */}
      <body className="bg-slate-50 text-slate-900 min-h-screen pb-20 sm:pb-8 antialiased">
        {children}
      </body>
    </html>
  );
}
