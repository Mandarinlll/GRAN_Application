// 画面上部の固定ヘッダー。ロゴ + ログイン中ユーザーのバッジを表示。
// 元 home.html の <header> を移植したもの。

import { Trophy, ChevronDown } from "lucide-react";
import type { CurrentUser } from "@/types/home";

// props としてログイン中ユーザー1人分のデータを受け取る。
type Props = {
  user: CurrentUser;
};

export function AppHeader({ user }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* ロゴ & アプリ名 */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">
              GRAN TENNIS
            </span>
            <span className="text-[10px] text-emerald-600 font-bold ml-1 px-1.5 py-0.5 bg-emerald-50 rounded">
              2026 Season
            </span>
          </div>
        </div>

        {/* ユーザープロフィールバッジ */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-full">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
            {user.avatarText}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-none text-slate-800">
              {user.realName}
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              Rate:{" "}
              <span className="font-bold text-emerald-600 font-mono">
                {user.granLevel}
              </span>{" "}
              ({user.classLabel})
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
