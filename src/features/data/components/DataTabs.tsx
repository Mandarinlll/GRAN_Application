// データタブ内の画面切替（マイデータ / 出場データ / ランキング）。
// 選択中は aria-current="page" と下線+背景色で強調する。
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const DATA_TABS = [
  { href: "/data/me", label: "マイデータ" },
  { href: "/data/participations", label: "出場データ" },
  { href: "/data/ranking", label: "ランキング" },
] as const;

export function DataTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="データ表示切替" className="border-b border-slate-200 dark:border-slate-800">
      <ul className="flex flex-nowrap">
        {DATA_TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center min-h-[44px] px-2 text-sm whitespace-nowrap border-b-2 transition",
                  active
                    ? "font-bold border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    : "border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
