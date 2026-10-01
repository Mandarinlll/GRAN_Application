// ヘッダー右側のユーザーバッジ + ドロップダウン（ログアウト導線）。
// クリックで開閉するためクライアントコンポーネント。
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/server/actions";
import type { CurrentUser } from "@/types/home";

type Props = {
  user: CurrentUser;
};

export function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる。
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-full hover:bg-slate-100 transition"
      >
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
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-100 shadow-lg z-50 overflow-hidden"
        >
          {/* ユーザー情報ヘッダー */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {user.nickname}
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              ID: {user.displayId}
            </p>
          </div>

          {/* ログアウト（Server Action をフォームで送信） */}
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>ログアウト</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
