// PC（640px以上）で常時表示する左側固定サイドバー。
// 元 tests/data.html の <aside> を移植・調整したもの。
//
// ユーザー指定のブレイクポイントは sm:（640px以上）。
// モバイル（640px未満）では非表示（hidden）にして、代わりに BottomNav を使う。
// クリック（onClick / ログアウト導線）があるのでクライアントコンポーネント。
"use client";

import {
  Trophy,
  Home,
  Calendar,
  Database,
  Bell,
  Settings,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/features/auth/server/actions";
import type { CurrentUser } from "@/types/home";

// サイドバーに出すログイン中ユーザー1人分のデータを受け取る。
type Props = {
  user: CurrentUser;
};

// メニュー1件分の形。
// active: 今表示中のページか（緑で強調）
// badge: 通知の未読件数など、数字バッジを出したいとき
type NavItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  badge?: number;
};

// 遷移先は各ページ未実装のため、ホーム以外は暫定で alert を出すだけ。
// 実ルーティングは各画面実装時に差し替える。
const navItems: NavItem[] = [
  { key: "home", label: "ホーム", icon: Home, active: true },
  { key: "schedule", label: "大会日程", icon: Calendar },
  { key: "data", label: "データ", icon: Database },
  { key: "notifications", label: "通知", icon: Bell, badge: 3 },
  { key: "settings", label: "設定", icon: Settings },
];

export function Sidebar({ user }: Props) {
  // ホーム以外のクリック時の暫定挙動。
  function handleNavigate(label: string) {
    alert(`${label}画面へ遷移します`);
  }

  return (
    <aside className="hidden sm:flex flex-col fixed top-0 bottom-0 left-0 w-60 bg-white border-r border-slate-200 z-40 shadow-sm">
      {/* 上部: ロゴ & アプリ名 */}
      <div className="h-14 px-4 flex items-center border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">
              GRANde
            </span>
            <span className="text-[10px] text-emerald-600 font-bold ml-1 px-1.5 py-0.5 bg-emerald-50 rounded">
              2026-27 Season
            </span>
          </div>
        </div>
      </div>

      {/* 中央: メニューリスト */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;

          // アクティブ（今表示中）なら緑系で強調、それ以外はグレー。
          const className = item.active
            ? "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 hover:bg-slate-100 w-full";

          const iconClassName = item.active
            ? "w-4 h-4 text-emerald-600"
            : "w-4 h-4 text-slate-400";

          // メニュー内側の共通中身（アイコン + ラベル + 任意のバッジ）。
          const inner = (
            <>
              <span className="flex items-center gap-3">
                <Icon className={iconClassName} />
                <span>{item.label}</span>
              </span>
              {item.badge ? (
                <span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold font-mono">
                  {item.badge}
                </span>
              ) : null}
            </>
          );

          // ホーム（アクティブ）は現在地なのでボタン化せず、見た目だけ強調。
          if (item.active) {
            return (
              <div key={item.key} className={className} aria-current="page">
                {inner}
              </div>
            );
          }

          // それ以外は押せるボタン（暫定 alert）。
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigate(item.label)}
              className={className}
            >
              {inner}
            </button>
          );
        })}
      </nav>

      {/* 下部: ログインユーザー簡易カード + ログアウト */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {user.avatarText}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate">
              {user.realName}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              Rate:{" "}
              <span className="font-bold text-emerald-600 font-mono">
                {user.granLevel}
              </span>{" "}
              ({user.classLabel})
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>

        {/* ログアウト（Server Action をフォームで送信） */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
