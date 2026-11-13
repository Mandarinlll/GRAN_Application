// 通知受信箱（notifications テーブル）の永続化抽象。
// 実装は infrastructure/SqliteInboxNotificationRepository。ドメイン層のため DB に依存しない。

import type {
  InboxNotification,
  NewInboxNotification,
  PendingMemberTarget,
  ReminderTarget,
} from "@/features/notifications/domain/InboxNotification";

export interface InboxNotificationRepository {
  // --- 通知の元データ（エントリー側の読み取りモデル） ---
  // today（JST "YYYY-MM-DD"）以降に開催される確定エントリーの参加者。userId 指定で絞り込む。
  listReminderTargets(today: string, userId?: string): ReminderTarget[];
  // 未定枠（PENDING）が残っている確定エントリー。通知先はエントリーの申込者。
  listPendingMemberTargets(today: string, userId?: string): PendingMemberTarget[];

  // --- 通知の書き込み ---
  // dedupeKey が既存なら何もしない（リマインド用）。
  insertIfAbsent(notification: NewInboxNotification): void;
  // dedupeKey が既存なら本文を更新し、解消済みなら再び未対応に戻す（メンバー未定用）。
  upsertOpen(notification: NewInboxNotification): void;
  // 指定種別の未解消通知のうち activeKeys に含まれないものを解消済みにする。
  resolveMissing(
    kind: NewInboxNotification["kind"],
    activeKeys: string[],
    userId?: string,
  ): void;

  // --- 通知の参照・既読 ---
  listByUser(userId: string): InboxNotification[];
  countUnread(userId: string): number;
  markRead(userId: string, notificationId: string): void;
  markAllRead(userId: string): void;
}
