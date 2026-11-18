// 通知の表示用ヘルパー（一覧・詳細で共用）。
import { Bell, CalendarClock, Megaphone, Siren, UserPlus, Users } from "lucide-react";
import type {
  InboxKind,
  InboxNotification,
} from "@/features/notifications/types/notification";

export const KIND_ICON: Record<InboxKind, typeof Bell> = {
  REMINDER_7DAYS: CalendarClock,
  MEMBER_ASSIGN: Users,
  TEAM_INVITE: UserPlus,
  ANNOUNCEMENT: Megaphone,
  URGENT: Siren,
};

export const KIND_LABEL: Record<InboxKind, string> = {
  REMINDER_7DAYS: "リマインド",
  MEMBER_ASSIGN: "メンバー指定の依頼",
  TEAM_INVITE: "チームへの招待",
  ANNOUNCEMENT: "運営からのお知らせ",
  URGENT: "緊急のお知らせ",
};

// "YYYY-MM-DD HH:MM:SS" → "M/D HH:MM"。
export function formatReceivedAt(value: string): string {
  const [date, time = ""] = value.split(" ");
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)} ${time.slice(0, 5)}`;
}

// 未対応の要対応通知か（リマインドは対応不要）。
export function needsAction(n: InboxNotification): boolean {
  return (n.kind === "MEMBER_ASSIGN" || n.kind === "TEAM_INVITE") && !n.isResolved;
}
