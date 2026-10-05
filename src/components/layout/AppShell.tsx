// アプリ共通シェル（サイドバー + ヘッダー + ボトムナビ）。
// ui-design-system.md のレイアウト規約に準拠：
//  - PC（sm:640px以上）: 左固定サイドバー（w-60）、本文は sm:pl-60
//  - モバイル: 下部固定ボトムナビ（5項目・セーフエリア対応）
//
// クリック（未実装画面の案内・ログアウト）があるためクライアントコンポーネント。
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/features/auth/server/actions";
import { NAV_ITEMS, type NavId } from "@/components/layout/navConfig";
import { granLevelToClassLabel } from "@/features/auth/utils/classLabel";

// シェルが表示に必要とする最小のユーザー情報。
export interface ShellUser {
  realName: string;
  nickname: string;
  granLevel: number;
  // ニックネーム頭文字などアバター表示用の1文字。
  avatarText: string;
  teamName: string | null;
}

type Props = {
  activeId: NavId;
  user: ShellUser;
  children: React.ReactNode;
};

export function AppShell({ activeId, user, children }: Props) {
  const classLabel = granLevelToClassLabel(user.granLevel);

  return (
    <>
      <Sidebar activeId={activeId} user={user} classLabel={classLabel} />

      {/* サイドバー分の左余白（sm以上）。 */}
      <div className="sm:pl-60">
        <MobileHeader user={user} classLabel={classLabel} />
        {children}
      </div>

      <BottomNav activeId={activeId} />
    </>
  );
}

// --- PC用サイドバー ---
function Sidebar({
  activeId,
  user,
  classLabel,
}: {
  activeId: NavId;
  user: ShellUser;
  classLabel: string;
}) {
  return (
    <aside className="hidden sm:flex flex-col fixed top-0 bottom-0 left-0 w-60 bg-white border-r border-slate-200 z-40 shadow-sm">
      <div className="h-14 px-4 flex items-center border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-slate-900">
              GRANde
            </span>
            <span className="block text-xs text-emerald-600 font-bold">
              2026 Season
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} active={item.id === activeId} />
        ))}
      </nav>

      <div className="p-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {user.avatarText}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate">
              {user.realName}
            </div>
            <div className="text-xs text-slate-500 truncate">
              Rate:{" "}
              <span className="font-bold text-emerald-600 tabular-nums">
                {user.granLevel}
              </span>{" "}
              ({classLabel})
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3.5 min-h-[44px] rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

// サイドバーのリンク1件。未実装画面は無効スタイル + 案内。
function NavLink({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const Icon = item.icon;
  const base =
    "flex items-center justify-between gap-3 px-3.5 min-h-[44px] rounded-xl text-xs font-bold transition";

  const inner = (
    <>
      <span className="flex items-center gap-3">
        <Icon
          className={cn("w-4 h-4", active ? "text-emerald-600" : "text-slate-400")}
        />
        <span>{item.label}</span>
      </span>
      {item.badge ? (
        <span className="min-w-4 h-4 px-1 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center font-bold tabular-nums">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  if (active) {
    return (
      <div
        aria-current="page"
        className={cn(base, "bg-emerald-50 text-emerald-700 border border-emerald-200")}
      >
        {inner}
      </div>
    );
  }

  if (!item.implemented) {
    return (
      <button
        type="button"
        onClick={() => alert(`${item.label}画面は現在準備中です`)}
        className={cn(
          base,
          "w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100",
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        base,
        "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      )}
    >
      {inner}
    </Link>
  );
}

// --- モバイル用ヘッダー（sm未満のみ） ---
function MobileHeader({
  user,
  classLabel,
}: {
  user: ShellUser;
  classLabel: string;
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm sm:hidden">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-slate-900">
              GRAN TENNIS
            </span>
            <span className="text-xs text-emerald-600 font-bold ml-1 px-1.5 py-0.5 bg-emerald-50 rounded">
              2026
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-full">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
            {user.avatarText}
          </div>
          <div className="text-left hidden min-[400px]:block">
            <div className="text-xs font-bold leading-none text-slate-800">
              {user.realName}
            </div>
            <div className="text-xs text-slate-500 leading-tight">
              Rate:{" "}
              <span className="font-bold text-emerald-600 tabular-nums">
                {user.granLevel}
              </span>{" "}
              ({classLabel})
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// --- モバイル用ボトムナビ（sm未満のみ・セーフエリア対応） ---
function BottomNav({ activeId }: { activeId: NavId }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 sm:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14 text-xs font-medium text-slate-500">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          const content = (
            <>
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center font-bold tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="leading-none">{item.label}</span>
            </>
          );
          const cls = cn(
            "flex flex-col items-center justify-center min-h-[44px] transition-colors",
            active
              ? "text-emerald-600 font-bold"
              : "text-slate-500 hover:text-slate-900",
          );

          if (active) {
            return (
              <div key={item.id} className={cls} aria-current="page">
                {content}
              </div>
            );
          }
          if (!item.implemented) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => alert(`${item.label}画面は現在準備中です`)}
                className={cls}
              >
                {content}
              </button>
            );
          }
          return (
            <Link key={item.id} href={item.href} className={cls}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
