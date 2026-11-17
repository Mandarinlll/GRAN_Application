// 管理コンソール共通シェル（ヘッダー + サイドバー）。サーバーコンポーネント。
// ナビの出し分けは表示上の補助にすぎない。実際の認可は各ページ/Action/APIのガードで行う。

import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/features/auth/server/actions";
import { HOME_HREF } from "@/components/layout/navConfig";
import { ADMIN_HOME_HREF, allowedAdminNavIds } from "@/features/admin/utils/navConfig";
import { AdminNav } from "@/features/admin/components/AdminNav";
import type { AdminContext } from "@/features/admin/types/permissions";

const ROLE_LABEL = { ADMIN: "管理者", OPERATOR: "運営者" } as const;

type Props = {
  admin: AdminContext;
  children: React.ReactNode;
};

export function AdminShell({ admin, children }: Props) {
  const allowedIds = allowedAdminNavIds(admin.role);

  return (
    <div className="min-h-screen bg-slate-50">
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
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>ログアウト</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="sm:flex">
        {/* PC: 左サイドバー */}
        <aside className="hidden sm:block w-60 shrink-0 bg-white border-r border-slate-200 p-3 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto">
          <AdminNav allowedIds={allowedIds} variant="sidebar" />
        </aside>

        {/* モバイル: ヘッダー下の横並びナビ */}
        <div className="sm:hidden bg-white border-b border-slate-200 p-2">
          <AdminNav allowedIds={allowedIds} variant="bar" />
        </div>

        <main className="flex-1 min-w-0 max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
