// アプリ共通ナビゲーションの項目定義（サイドバー / ボトムナビ / ヘッダー共用）。
// ui-design-system.md 7.1 / 7.2 のナビ構成に準拠（ホーム/大会日程/データ/通知/設定）。

import { Home, Calendar, Database, Bell, Settings } from "lucide-react";

export type NavId = "home" | "schedule" | "data" | "notifications" | "settings";

export interface NavItemDef {
  id: NavId;
  label: string;
  href: string;
  icon: typeof Home;
  // 未実装画面は href を "#" とし、クリック時に案内を出す。
  implemented: boolean;
  badge?: number;
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: "home", label: "ホーム", href: "/", icon: Home, implemented: true },
  {
    id: "schedule",
    label: "大会日程",
    href: "/tournaments",
    icon: Calendar,
    implemented: true,
  },
  { id: "data", label: "データ", href: "#", icon: Database, implemented: false },
  {
    id: "notifications",
    label: "通知",
    href: "#",
    icon: Bell,
    implemented: false,
    badge: 3,
  },
  { id: "settings", label: "設定", href: "#", icon: Settings, implemented: false },
];
