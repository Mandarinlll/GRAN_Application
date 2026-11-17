// 管理コンソール共通シェル（ヘッダー + ナビ）。サーバーコンポーネント。
// ナビの出し分けは表示上の補助にすぎない。実際の認可は各ページ/Action/APIのガードで行う。

import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/features/auth/server/actions";
import { roleHasPermission } from "@/features/admin/utils/permissions";
import { ADMIN_NAV_ITEMS } from "@/features/admin/utils/navConfig";
import type { AdminContext } from "@/features/admin/types/permissions";

const ROLE_LABEL = { ADMIN: "管理者", OPERATOR: "運営者" } as const;

type Props = {
  admin: AdminContext;
  children: React.ReactNode;
};

export function AdminShell({ admin, children }: Props) {
  const items = ADMIN_NAV_ITEMS.filter((item) =>
    roleHasPermission(admin.role, item.permission),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-tight">GRAN 管理コンソール</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600">
              {ROLE_LABEL[admin.role]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-slate-300 hover:text-white min-h-[44px] flex items-center">
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
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto" aria-label="管理メニュー">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="px-3 min-h-[44px] flex items-center text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-t-lg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
