// 管理コンソール共通シェル（ヘッダー + サイドバー）。サーバーコンポーネント。
// ナビの出し分けは表示上の補助にすぎない。実際の認可は各ページ/Action/APIのガードで行う。

import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
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
  const card = {
    realName: user?.realName ?? admin.loginId,
    avatarText: (user?.nickname || user?.realName || admin.loginId).slice(0, 1),
    granLevel: user?.granLevel ?? 0,
    roleLabel: ROLE_LABEL[admin.role],
  };

  return (
    // -mb-*: ルートレイアウトの body 下余白（ユーザー画面のボトムナビ用 pb-20 / sm:pb-8）を管理画面では打ち消す。
    <div className="min-h-screen bg-slate-50 -mb-20 sm:-mb-8">
      <header className="bg-slate-900 text-white sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <Link
            href={ADMIN_HOME_HREF}
            aria-label="管理コンソールのトップへ"
            className="flex items-center gap-2.5 min-h-[44px] hover:opacity-80 transition"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-tight">GRAN 管理コンソール</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600">
              {ROLE_LABEL[admin.role]}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={HOME_HREF} className="text-xs text-slate-300 hover:text-white min-h-[44px] flex items-center">
              ユーザー画面へ
            </Link>
          </div>
        </div>
      </header>

      <div className="sm:flex">
        {/* PC: 左サイドバー */}
        <aside className="hidden sm:flex w-60 shrink-0 bg-white border-r border-slate-200 p-3 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <AdminNav allowedIds={allowedIds} variant="sidebar" />
          </div>
          {/* ユーザー画面（AppShell）のサイドバー下部と同じ構成: アカウントカード + ログアウト */}
          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <AdminUserCard {...card} variant="sidebar" />
            <LogoutButton />
          </div>
        </aside>

        {/* モバイル: ヘッダー下の横並びナビ */}
        <div className="sm:hidden bg-white border-b border-slate-200 p-2 space-y-2">
          {/* モバイルはサイドバーが無いため、カードの横にログアウトを置く */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <AdminUserCard {...card} variant="compact" />
            </div>
            <LogoutButton />
          </div>
          <AdminNav allowedIds={allowedIds} variant="bar" />
        </div>

        <main className="flex-1 min-w-0 max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

// ログアウトボタン。ユーザー画面（AppShell）のサイドバー下部と同じデザイン。
function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="w-full flex items-center gap-2 px-3.5 min-h-[44px] rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
      >
        <LogOut className="w-4 h-4" />
        <span>ログアウト</span>
      </button>
    </form>
  );
}