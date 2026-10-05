// 画面下部の固定ナビ（モバイル用）。元 home.html の <nav> を移植。
//
// 先頭の "use client" が重要。
// Next.js のコンポーネントは初期状態では「サーバー側で動く」。
// でもクリック（onClick）など「ブラウザ上の操作」を扱うには、
// このファイルを「クライアント（ブラウザ側）で動く」と宣言する必要がある。
// その宣言が "use client"。ボタンを押す動きがあるのでここでは必須。
"use client";

import Link from "next/link";
import { Home, Calendar, Database, Bell, Settings } from "lucide-react";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 sm:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14 text-xs font-medium text-slate-500">
        {/* ホーム（今表示中なので緑で強調） */}
        <button className="flex flex-col items-center justify-center min-h-[44px] text-emerald-600 font-bold">
          <Home className="w-5 h-5 mb-0.5" />
          <span>ホーム</span>
        </button>

        {/* 大会日程・エントリー画面へ遷移 */}
        <Link
          href="/tournaments"
          className="flex flex-col items-center justify-center min-h-[44px] hover:text-slate-900"
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>大会日程</span>
        </Link>

        {/* データ（サイドバーと同じ並び・アイコン。遷移先未実装のため暫定アラート） */}
        <button
          onClick={() => alert("データ画面へ遷移します")}
          className="flex flex-col items-center justify-center hover:text-slate-900"
        >
          <Database className="w-5 h-5 mb-0.5" />
          <span>データ</span>
        </button>

        {/* 通知（未読バッジ付き） */}
        <button
          onClick={() => alert("通知画面へ遷移します")}
          className="flex flex-col items-center justify-center hover:text-slate-900"
        >
          <div className="relative">
            <Bell className="w-5 h-5 mb-0.5" />
            <span className="absolute -top-1 -right-2 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              3
            </span>
          </div>
          <span>通知</span>
        </button>

        {/* 設定 */}
        <button
          onClick={() => alert("設定画面へ遷移します")}
          className="flex flex-col items-center justify-center hover:text-slate-900"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span>設定</span>
        </button>
      </div>
    </nav>
  );
}
