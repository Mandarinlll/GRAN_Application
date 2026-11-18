// 管理コンソール共通シェル（サイドバー + 上部バー）。サーバーコンポーネント。
// ナビの出し分けは表示上の補助にすぎない。実際の認可は各ページ/Action/APIのガードで行う。
//
// レイアウトはユーザー画面の AppShell と揃える（ui-design-system.md のレイアウト規約）:
//  - PC（sm以上）: 左固定サイドバー w-60（ロゴ枠 h-14 / ナビ py-4 px-3 / 下部 p-3）、本文は sm:pl-60
//  - 上部バー: ユーザー画面のプレビューバナー（AdminBanner）と同じ高さ・余白（px-4 py-2）
//  - 本文: px-4 py-6・中央寄せ

import Link from "next/link";
import { ChevronRight, LogOut, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/features/auth/server/actions";
import { HOME_HREF } from "@/components/layout/navConfig";
import { ADMIN_HOME_HREF, allowedAdminNavIds } from "@/features/admin/utils/navConfig";
import { AdminUserCard } from "@/features/admin/components/AdminUserCard";
import { findUserById } from "@/features/auth/server/userRepository";
import { AdminNav } from "@/features/admin/components/AdminNav";
import type { AdminContext } from "@/features/admin/types/permissions";

const ROLE_LABEL = { ADMIN: "管理者", OPERATOR: "運営者" } as const;

type Props = {
  admin: AdminContext;
  children: React.ReactNode;
};

export function AdminShell({ admin, children }: Props) {
  const allowedIds = allowedAdminNavIds(admin.role);
  const user = findUserById(admin.userId);
  const roleLabel = ROLE_LABEL[admin.role];
  const card = {
    realName: user?.realName ?? admin.loginId,
    // ユーザー画面と同じく氏名の頭文字をアバターに出す。
    avatarText: (user?.realName || admin.loginId).charAt(0),
    granLevel: user?.granLevel ?? 0,
    roleLabel,
  };

  return (
    // -mb-*: ルートレイアウトの body 下余白（ユーザー画面のボトムナビ用 pb-20 / sm:pb-8）を管理画面では打ち消す。
    <div className="min-h-screen bg-slate-50 -mb-20 sm:-mb-8">
      {/* PC: 左固定サイドバー（AppShell の Sidebar と同じ寸法） */}
      <aside className="hidden sm:flex flex-col fixed top-0 bottom-0 left-0 w-60 bg-white border-r border-slate-200 z-40 shadow-sm">
        <div className="h-14 px-4 flex items-center border-b border-slate-100">
          <Brand roleLabel={roleLabel} />
        </div>
        <div className="flex-1 py-4 px-3 overflow-y-auto">
          <AdminNav allowedIds={allowedIds} variant="sidebar" />
        </div>
        <div className="p-3 border-t border-slate-100 space-y-2">
          <AdminUserCard {...card} variant="sidebar" />
          <LogoutButton />
        </div>
      </aside>

      <div className="sm:pl-60">
        {/* 上部バー（ユーザー画面のプレビューバナーと同じ高さ・余白・位置。モバイルでもヘッダーより上） */}
        <div className="bg-slate-900 text-slate-200 text-xs px-4 py-2 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white">
              <ShieldCheck className="w-3 h-3" />
              {roleLabel}
            </span>
            <span className="truncate">管理コンソール</span>
          </div>
          <Link
            href={HOME_HREF}
            className="shrink-0 ml-3 inline-flex items-center gap-1 px-3 min-h-[44px] -my-2 rounded font-bold text-white hover:bg-slate-800 transition"
          >
            ユーザー画面へ
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* モバイル: ヘッダー（AppShell の MobileHeader と同じ h-14 / px-4） */}
        <header className="sm:hidden bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="px-4 h-14 flex items-center justify-between gap-2">
            <Brand roleLabel={roleLabel} />
            <LogoutButton compact />
          </div>
        </header>
        <div className="sm:hidden bg-white border-b border-slate-200 px-4 py-2 space-y-2">
          <AdminUserCard {...card} variant="compact" />
          <AdminNav allowedIds={allowedIds} variant="bar" />
        </div>

        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

// ロゴ枠。ユーザー画面のロゴ（アイコン 8x8 + 2行テキスト）と同じ寸法。
function Brand({ roleLabel }: { roleLabel: string }) {
  return (
    <Link
      href={ADMIN_HOME_HREF}
      aria-label="管理コンソールのトップへ"
      className="flex items-center gap-2.5 min-h-[44px] rounded-lg hover:opacity-80 transition"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center shadow-sm">
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div>
        <span className="font-bold text-base tracking-tight text-slate-900">GRANde</span>
        <span className="block text-xs text-emerald-600 font-bold">管理コンソール（{roleLabel}）</span>
      </div>
    </Link>
  );
}

// ログアウトボタン。ユーザー画面（AppShell）のサイドバー下部と同じデザイン。
function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={
          compact
            ? "flex items-center gap-1.5 px-2.5 min-h-[44px] rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
            : "w-full flex items-center gap-2 px-3.5 min-h-[44px] rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
        }
      >
        <LogOut className="w-4 h-4" />
        <span>ログアウト</span>
      </button>
    </form>
  );
}
