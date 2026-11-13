// 通知ページ（受信箱）のアプリケーションサービス。
//
// 通知はエントリーの状態から導出する:
//  - リマインド : 開催7日前 9:00（JST）を過ぎた確定エントリーの参加者へ1回だけ作成する。
//                 申込がその時刻より後（直前の申込）の場合は「近づいた」通知にならないため作らない。
//  - メンバー未定: 未定枠（PENDING）が残る確定エントリーの申込者へ作成し、
//                 未定枠が無くなる/キャンセルされると解消済みにする。
// 実行契機は「通知ページ・バッジ表示時の遅延同期」と「定期実行（cron）からの全件同期」の両方。
// どちらも冪等（dedupeKey で重複作成しない）。

import type { SqliteUnitOfWork } from "@/lib/unitOfWork";
import {
  buildMemberPending,
  buildReminder,
  reminderFireAt,
  toJstString,
  type InboxNotification,
} from "@/features/notifications/domain/InboxNotification";
import type { InboxNotificationRepository } from "@/features/notifications/domain/InboxNotificationRepository";

export class InboxNotificationService {
  constructor(
    private readonly uow: SqliteUnitOfWork,
    private readonly inbox: InboxNotificationRepository,
  ) {}

  // 指定ユーザーの通知を最新化する。
  syncForUser(userId: string, now: Date = new Date()): void {
    this.sync(now, userId);
  }

  // 全ユーザーの通知を最新化する（定期実行用）。
  syncAll(now: Date = new Date()): void {
    this.sync(now);
  }

  // 最新化したうえで通知一覧を返す。
  list(userId: string, now: Date = new Date()): InboxNotification[] {
    this.sync(now, userId);
    return this.inbox.listByUser(userId);
  }

  // 最新化したうえで未読件数（未解消のみ）を返す。
  unreadCount(userId: string, now: Date = new Date()): number {
    this.sync(now, userId);
    return this.inbox.countUnread(userId);
  }

  markRead(userId: string, notificationId: string): void {
    this.inbox.markRead(userId, notificationId);
  }

  markAllRead(userId: string): void {
    this.inbox.markAllRead(userId);
  }

  private sync(now: Date, userId?: string): void {
    const nowJst = toJstString(now);
    const today = nowJst.slice(0, 10);

    this.uow.run(() => {
      // 1) リマインド
      for (const target of this.inbox.listReminderTargets(today, userId)) {
        const fireAt = reminderFireAt(target.eventDate);
        if (fireAt > nowJst) continue; // まだ送信時刻前
        if (target.appliedAt > fireAt) continue; // 送信時刻より後の申込
        this.inbox.insertIfAbsent(buildReminder(target));
      }

      // 2) メンバー未定（未定枠が残る間は未対応、無くなれば解消済み）
      const pending = this.inbox
        .listPendingMemberTargets(today, userId)
        .map(buildMemberPending);
      for (const n of pending) this.inbox.upsertOpen(n);
      this.inbox.resolveMissing(
        "MEMBER_PENDING",
        pending.map((n) => n.dedupeKey),
        userId,
      );
    });
  }
}
