// 管理コンソールのナビ項目。permission を満たすロールにのみ表示する（表示制御のみ）。
// 各機能の画面を実装する際は implemented を true にする。
//
// ユーザー画面の5ボタン（ホーム/大会日程/データ/通知/チーム）は「ホーム」1つに統合し、
// 展開すると残り4つが選べる（USER_NAV_CHILDREN は components/layout/navConfig の NAV_ITEMS を流用）。

import { Megaphone, Newspaper, Trophy, Users } from "lucide-react";
import { HOME_HREF, NAV_ITEMS, SETTINGS_HREF } from "@/components/layout/navConfig";
import { roleHasPermission } from "@/features/admin/utils/permissions";
import type { AdminPermission, AdminRole } from "@/features/admin/types/permissions";

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof Trophy;
  permission: AdminPermission;
  // 未実装の画面は押下時に「準備中」を案内する。
  implemented: boolean;
}

// 「ホーム」を展開したときに出すユーザー画面の項目（ホーム自体は除く）。
export const USER_NAV_CHILDREN = NAV_ITEMS.filter((item) => item.id !== "home");

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: "tournaments",
    label: "大会管理",
    href: "/admin/tournaments",
    icon: Trophy,
    permission: "entries.view",
    implemented: false,
  },
  {
    id: "notifications",
    label: "通知管理",
    href: "/admin/notifications",
    icon: Megaphone,
    permission: "console.access",
    implemented: false,
  },
  {
    id: "users-teams",
    label: "ユーザ・チーム管理",
    href: "/admin/users",
    icon: Users,
    permission: "accounts.manage",
    implemented: false,
  },
  {
    id: "topics",
    label: "トピックス管理",
    href: "/admin/topics",
    icon: Newspaper,
    permission: "topics.manage",
    implemented: true,
  },
];

// 管理コンソールのトップ（ダッシュボード）。ロゴから遷移する。
export const ADMIN_HOME_HREF = "/admin";

// ロールが表示できる管理ナビ項目の id（表示制御のみ）。
export function allowedAdminNavIds(role: AdminRole): string[] {
  return ADMIN_NAV_ITEMS.filter((item) => roleHasPermission(role, item.permission)).map(
    (item) => item.id,
  );
}

// 「ホーム」配下（ユーザー画面）にいるか。ホームの展開状態と強調表示に使う。
export function isUserAreaPath(pathname: string): boolean {
  return [HOME_HREF, SETTINGS_HREF, ...USER_NAV_CHILDREN.map((c) => c.href)].some((href) => {
    // /data/me → /data 配下全体をデータ扱いにする。
    const base = href.startsWith("/data") ? "/data" : href;
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}
