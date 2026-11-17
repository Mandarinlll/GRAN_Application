// 管理コンソールのナビ項目。permission を満たすロールにのみ表示する（表示制御のみ）。
// 各機能の画面を実装する際にここへ項目を追加する。

import type { AdminPermission } from "@/features/admin/types/permissions";

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  permission: AdminPermission;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", label: "ダッシュボード", href: "/admin", permission: "console.access" },
];
