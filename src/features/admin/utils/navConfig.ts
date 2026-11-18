// 管理コンソール（/admin 配下）のナビ項目。permission を満たすロールにのみ表示する（表示制御のみ）。
// 各機能の画面を実装する際は implemented を true にする。
// 先頭の「ホーム」（/admin）は AdminNav が固定で出す。ユーザー画面の項目は含めない。

import { Megaphone, Trophy, Users } from "lucide-react";
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

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: "tournaments",
    label: "大会管理",
    href: "/admin/tournaments",
    icon: Trophy,
    permission: "entries.view",
    implemented: true,
  },
  {
    id: "notifications",
    label: "通知管理",
    href: "/admin/notifications",
    icon: Megaphone,
    permission: "notifications.manage",
    implemented: true,
  },
  {
    id: "users-teams",
    label: "ユーザ・チーム管理",
    href: "/admin/users",
    icon: Users,
    permission: "accounts.manage",
    implemented: false,
  },
];

// 管理コンソールのトップ（ダッシュボード）。ナビの「ホーム」とロゴから遷移する。
export const ADMIN_HOME_HREF = "/admin";

// ロールが表示できる管理ナビ項目の id（表示制御のみ）。
export function allowedAdminNavIds(role: AdminRole): string[] {
  return ADMIN_NAV_ITEMS.filter((item) => roleHasPermission(role, item.permission)).map(
    (item) => item.id,
  );
}
