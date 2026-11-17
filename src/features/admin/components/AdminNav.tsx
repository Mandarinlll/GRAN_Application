// 管理者用ナビ（PC: 左サイドバー / モバイル: ヘッダー下の横並び）。
// 管理画面（AdminShell）と、管理者・運営者が開いたユーザー画面（AppShell）の両方で使う。
//
// 「ホーム」: 1回目の押下で配下（大会日程/データ/通知/チーム）を展開し、
//            展開中にもう一度押すとホーム画面（/home）へ遷移する。右の矢印で折りたたむ。
// 表示項目は親がロールで絞り込んだ id のみ。実際の認可は各ページ/API のガードで行う。
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_HREF } from "@/components/layout/navConfig";
import {
  ADMIN_NAV_ITEMS,
  USER_NAV_CHILDREN,
  isUserAreaPath,
} from "@/features/admin/utils/navConfig";

type Props = {
  // 表示を許可する項目の id（アイコン等の関数はサーバー→クライアントへ渡せないため id のみ受け取る）。
  allowedIds: string[];
  // sidebar: PC 用の縦並び / bar: モバイル用の横並び
  variant: "sidebar" | "bar";
};

// 子項目が現在地か（/data/me は /data 配下全体を対象にする）。
function isChildActive(pathname: string, href: string): boolean {
  const base = href.startsWith("/data") ? "/data" : href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AdminNav({ allowedIds, variant }: Props) {
  const items = ADMIN_NAV_ITEMS.filter((i) => allowedIds.includes(i.id));
  const pathname = usePathname();
  const router = useRouter();
  const inUserArea = isUserAreaPath(pathname);
  // ユーザー画面を表示中は最初から展開しておく。
  const [homeOpen, setHomeOpen] = useState(inUserArea);
  const vertical = variant === "sidebar";

  const base =
    "flex items-center gap-3 px-3.5 min-h-[44px] rounded-xl text-xs font-bold transition whitespace-nowrap";
  const idle = "text-slate-600 hover:text-slate-900 hover:bg-slate-100";
  const active = "bg-emerald-50 text-emerald-700 border border-emerald-200";

  const onHomeClick = () => {
    if (!homeOpen) setHomeOpen(true);
    else router.push(HOME_HREF);
  };

  const homeActive = pathname === HOME_HREF;

  return (
    <nav aria-label="管理メニュー" className={cn(vertical ? "space-y-1.5" : "flex flex-wrap gap-1.5")}>
      <div className={cn(vertical ? "space-y-1" : "contents")}>
        <div className={cn("flex items-stretch gap-1", vertical && "w-full")}>
          <button
            type="button"
            aria-expanded={homeOpen}
            aria-current={homeActive ? "page" : undefined}
            title={homeOpen ? "もう一度押すとホームを表示します" : "押すとメニューを展開します"}
            onClick={onHomeClick}
            className={cn(base, homeActive ? active : idle, vertical && "flex-1")}
          >
            <Home className={cn("w-4 h-4", homeActive ? "text-emerald-600" : "text-slate-400")} />
            ホーム
          </button>
          {homeOpen ? (
            <button
              type="button"
              aria-label="ホームのメニューを閉じる"
              onClick={() => setHomeOpen(false)}
              className="w-11 min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
            >
              <ChevronDown className="w-4 h-4 rotate-180" />
            </button>
          ) : null}
        </div>

        {homeOpen ? (
          <ul className={cn(vertical ? "ml-4 pl-2 border-l border-slate-200 space-y-1" : "contents")}>
            {USER_NAV_CHILDREN.map((c) => {
              const Icon = c.icon;
              const on = isChildActive(pathname, c.href);
              return (
                <li key={c.id} className={vertical ? undefined : "contents"}>
                  <Link
                    href={c.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(base, on ? active : idle)}
                  >
                    <Icon className={cn("w-4 h-4", on ? "text-emerald-600" : "text-slate-400")} />
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

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
