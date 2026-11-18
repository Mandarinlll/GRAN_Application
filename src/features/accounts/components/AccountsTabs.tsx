// ユーザー / チームの切り替えタブ（一覧ページ上部）。タブは高さ・幅とも 44px 以上。
import Link from "next/link";
import { cn } from "@/lib/utils";

export type AccountsTabId = "users" | "teams";

const TABS: { id: AccountsTabId; label: string; href: string }[] = [
  { id: "users", label: "ユーザー", href: "/admin/users" },
  { id: "teams", label: "チーム", href: "/admin/teams" },
];

export function AccountsTabs({ active }: { active: AccountsTabId }) {
  return (
    <nav aria-label="ユーザー・チーム切り替え" className="flex gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] min-w-[44px] items-center justify-center border-b-2 px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              isActive
                ? "border-emerald-600 font-bold text-emerald-700"
                : "border-transparent font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
