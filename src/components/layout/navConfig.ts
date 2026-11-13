// アプリ共通ナビゲーションの項目定義（サイドバー / ボトムナビ / ヘッダー共用）。
// ui-design-system.md 7.1 / 7.2 のナビ構成に準拠（ホーム/大会日程/データ/通知/チーム）。
//
// 旧「設定」ナビ枠（未実装プレースホルダー）は、将来の「チーム」ページ用に改名した。
// 本物の設定ページ（/settings）は、ナビ枠ではなくユーザーカード（アバター）から開く。

import { Home, Calendar, Database, Bell, Users } from "lucide-react";

// "settings" はナビ項目ではないが、設定ページの AppShell activeId として使う。
export type NavId =
  | "home"
  | "schedule"
  | "data"
  | "notifications"
  | "team"
  | "settings";

export interface NavItemDef {
  id: NavId;
  label: string;
  href: string;
  icon: typeof Home;
  // 未実装画面は href を "#" とし、クリック時に案内を出す。
  implemented: boolean;
  badge?: number;
}

// 設定ページの URL（ユーザーカードからの導線で使用）。
export const SETTINGS_HREF = "/settings";

export const NAV_ITEMS: NavItemDef[] = [
  { id: "home", label: "ホーム", href: "/", icon: Home, implemented: true },
  {
    id: "schedule",
    label: "大会日程",
    href: "/tournaments",
    icon: Calendar,
    implemented: true,
  },
  {
    id: "data",
    label: "データ",
    href: "/data/me",
    icon: Database,
    implemented: true,
  },
  {
    id: "notifications",
    label: "通知",
    href: "/notifications",
    icon: Bell,
    implemented: true,
  },
  { id: "team", label: "チーム", href: "#", icon: Users, implemented: false },
];
