// 管理者用ナビ（PC: 左サイドバー / モバイル: ヘッダー下の横並び）。/admin 配下（AdminShell）専用。
// ユーザー画面（大会日程/データ/通知/チーム）へはヘッダーの「ユーザー画面へ」から移動する。
// 表示項目は親がロールで絞り込んだ id のみ。実際の認可は各ページ/API のガードで行う。
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_HOME_HREF, ADMIN_NAV_ITEMS } from "@/features/admin/utils/navConfig";

type Props = {
  // 表示を許可する項目の id（アイコン等の関数はサーバー→クライアントへ渡せないため id のみ受け取る）。
  allowedIds: string[];
  // sidebar: PC 用の縦並び / bar: モバイル用の横並び
  variant: "sidebar" | "bar";
};

export function AdminNav({ allowedIds, variant }: Props) {
  const items = ADMIN_NAV_ITEMS.filter((i) => allowedIds.includes(i.id));
  const pathname = usePathname();
  const vertical = variant === "sidebar";

  const base =
    "flex items-center gap-3 px-3.5 min-h-[44px] rounded-xl text-xs font-bold transition whitespace-nowrap";
  const idle = "text-slate-600 hover:text-slate-900 hover:bg-slate-100";
  const active = "bg-emerald-50 text-emerald-700 border border-emerald-200";

  // 「ホーム」= 管理画面のトップ（ダッシュボード）。
  const homeActive = pathname === ADMIN_HOME_HREF;

  return (
    <nav aria-label="管理メニュー" className={cn(vertical ? "space-y-1.5" : "flex flex-wrap gap-1.5")}>
      <Link
        href={ADMIN_HOME_HREF}
        aria-current={homeActive ? "page" : undefined}
        className={cn(base, homeActive ? active : idle, vertical && "w-full")}
      >
        <Home className={cn("w-4 h-4", homeActive ? "text-emerald-600" : "text-slate-400")} />
        ホーム
      </Link>

      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const inner = (
          <>
            <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-slate-400")} />
            {item.label}
          </>
        );

        if (!item.implemented) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => alert(`${item.label}画面は現在準備中です`)}
              className={cn(base, idle, vertical && "w-full")}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(base, isActive ? active : idle, vertical && "w-full")}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
