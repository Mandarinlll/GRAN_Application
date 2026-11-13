// 通知ページ（アプリ内の通知受信箱）のドメイン定義。
//
// notification_logs（送信ログ）とは別物で、ユーザーが /notifications で閲覧・対応する
// 通知そのものを表す。DB・Zod・Next.js に依存しない純粋な TypeScript とする。
//
// 通知の種類:
//  - REMINDER       : 参加予定の大会の開催7日前 9:00（JST）に届くリマインド。
//  - MEMBER_PENDING : 団体戦等で未定枠のままエントリーした際の「出場メンバー登録」督促。
//                     ゲスト（未登録ユーザー）枠は氏名入力で完結するため対象外。

export type InboxKind = "REMINDER" | "MEMBER_PENDING";

// 画面の絞り込みカテゴリ（tests/notifications.html のモックに準拠）。
export type InboxCategory = "ACTION" | "ENTRY" | "LEVEL" | "OTHER";

export const INBOX_CATEGORIES: readonly InboxCategory[] = [
  "ACTION",
  "ENTRY",
  "LEVEL",
  "OTHER",
];

// リマインドを送る開催日からの日数と時刻（JST）。
export const REMINDER_DAYS_BEFORE = 7;
export const REMINDER_HOUR_LABEL = "09:00:00";

export interface InboxNotification {
  id: string;
  userId: string;
  kind: InboxKind;
  category: InboxCategory;
  title: string;
  body: string;
  tournamentId: string | null;
  entryId: string | null;
  isRead: boolean;
  // 要対応が解消された日時（JST）。未解消なら null。リマインドは常に null。
  resolvedAt: string | null;
  createdAt: string;
}

// 新規作成時の入力。dedupeKey が同じ通知は重複作成しない。
export interface NewInboxNotification {
  userId: string;
  kind: InboxKind;
  category: InboxCategory;
  title: string;
  body: string;
  tournamentId: string;
  entryId: string;
  dedupeKey: string;
  createdAt: string;
}

// 通知の元になるエントリー情報（リポジトリが返す読み取りモデル）。
export interface ReminderTarget {
  userId: string;
  entryId: string;
  tournamentId: string;
  tournamentTitle: string;
  eventDate: string;
  appliedAt: string;
}

export interface PendingMemberTarget {
  userId: string;
  entryId: string;
  tournamentId: string;
  tournamentTitle: string;
  eventDate: string;
  pendingCount: number;
  appliedAt: string;
}

export function categoryOf(kind: InboxKind): InboxCategory {
  return kind === "MEMBER_PENDING" ? "ACTION" : "ENTRY";
}

// Date を JST の "YYYY-MM-DD HH:MM:SS" 文字列にする（DB の保存形式 NOW_JST と同じ）。
export function toJstString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

// 開催日（"YYYY-MM-DD"）の7日前 9:00（JST）を返す。
export function reminderFireAt(eventDate: string): string {
  const [y, m, d] = eventDate.slice(0, 10).split("-").map(Number);
  const fire = new Date(Date.UTC(y, m - 1, d - REMINDER_DAYS_BEFORE));
  return `${fire.toISOString().slice(0, 10)} ${REMINDER_HOUR_LABEL}`;
}

// "2026-09-20" → "09/20"
function monthDay(eventDate: string): string {
  return `${eventDate.slice(5, 7)}/${eventDate.slice(8, 10)}`;
}

export function reminderDedupeKey(entryId: string, userId: string): string {
  return `REMINDER:${entryId}:${userId}`;
}

export function memberPendingDedupeKey(entryId: string): string {
  return `MEMBER_PENDING:${entryId}`;
}

export function buildReminder(target: ReminderTarget): NewInboxNotification {
  return {
    userId: target.userId,
    kind: "REMINDER",
    category: categoryOf("REMINDER"),
    title: "【リマインド】開催まであと7日",
    body: `【${monthDay(target.eventDate)} ${target.tournamentTitle}】の開催日が近づいています。持ち物・集合時間・出場メンバーをご確認ください。`,
    tournamentId: target.tournamentId,
    entryId: target.entryId,
    dedupeKey: reminderDedupeKey(target.entryId, target.userId),
    createdAt: reminderFireAt(target.eventDate),
  };
}

export function buildMemberPending(
  target: PendingMemberTarget,
): NewInboxNotification {
  return {
    userId: target.userId,
    kind: "MEMBER_PENDING",
    category: categoryOf("MEMBER_PENDING"),
    title: "【要対応】メンバー未定",
    body: `【${monthDay(target.eventDate)} ${target.tournamentTitle}】の出場メンバーが${target.pendingCount}名分「未定枠」のままです。お早めに出場メンバーを登録してください。`,
    tournamentId: target.tournamentId,
    entryId: target.entryId,
    dedupeKey: memberPendingDedupeKey(target.entryId),
    createdAt: target.appliedAt,
  };
}
