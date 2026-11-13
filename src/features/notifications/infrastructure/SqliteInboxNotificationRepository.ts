// InboxNotificationRepository の SQLite 実装。SQL はこの層にのみ閉じ込める。

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { NOW_JST } from "@/lib/db";
import type {
  InboxCategory,
  InboxKind,
  InboxNotification,
  NewInboxNotification,
  PendingMemberTarget,
  ReminderTarget,
} from "@/features/notifications/domain/InboxNotification";
import type { InboxNotificationRepository } from "@/features/notifications/domain/InboxNotificationRepository";

interface NotificationRow {
  id: string;
  user_id: string;
  kind: InboxKind;
  category: InboxCategory;
  title: string;
  body: string;
  tournament_id: string | null;
  entry_id: string | null;
  is_read: number;
  resolved_at: string | null;
  created_at: string;
}

export class SqliteInboxNotificationRepository
  implements InboxNotificationRepository
{
  constructor(private readonly db: DatabaseSync) {}

  listReminderTargets(today: string, userId?: string): ReminderTarget[] {
    // 参加者 = エントリー申込者 + 登録ユーザーとして割り当てられたメンバー。
    const rows = this.db
      .prepare(
        `SELECT p.user_id AS user_id, e.id AS entry_id, t.id AS tournament_id,
                t.title AS title, t.event_date AS event_date, e.applied_at AS applied_at
           FROM entries e
           JOIN tournaments t ON t.id = e.tournament_id
           JOIN (
             SELECT id AS entry_id, user_id FROM entries
             UNION
             SELECT entry_id, user_id FROM entry_members
              WHERE member_type = 'REGISTERED' AND user_id IS NOT NULL
           ) p ON p.entry_id = e.id
          WHERE e.status = 'CONFIRMED'
            AND t.status NOT IN ('DRAFT', 'CANCELLED')
            AND t.event_date >= ?
            AND (? IS NULL OR p.user_id = ?)`,
      )
      .all(today, userId ?? null, userId ?? null) as Array<{
      user_id: string;
      entry_id: string;
      tournament_id: string;
      title: string;
      event_date: string;
      applied_at: string;
    }>;
    return rows.map((r) => ({
      userId: r.user_id,
      entryId: r.entry_id,
      tournamentId: r.tournament_id,
      tournamentTitle: r.title,
      eventDate: r.event_date,
      appliedAt: r.applied_at,
    }));
  }

  listPendingMemberTargets(
    today: string,
    userId?: string,
  ): PendingMemberTarget[] {
    const rows = this.db
      .prepare(
        `SELECT e.user_id AS user_id, e.id AS entry_id, t.id AS tournament_id,
                t.title AS title, t.event_date AS event_date, e.applied_at AS applied_at,
                COUNT(m.id) AS pending_count
           FROM entries e
           JOIN tournaments t ON t.id = e.tournament_id
           JOIN entry_members m ON m.entry_id = e.id AND m.member_type = 'PENDING'
          WHERE e.status = 'CONFIRMED'
            AND t.status NOT IN ('DRAFT', 'CANCELLED')
            AND t.event_date >= ?
            AND (? IS NULL OR e.user_id = ?)
          GROUP BY e.id`,
      )
      .all(today, userId ?? null, userId ?? null) as Array<{
      user_id: string;
      entry_id: string;
      tournament_id: string;
      title: string;
      event_date: string;
      applied_at: string;
      pending_count: number;
    }>;
    return rows.map((r) => ({
      userId: r.user_id,
      entryId: r.entry_id,
      tournamentId: r.tournament_id,
      tournamentTitle: r.title,
      eventDate: r.event_date,
      appliedAt: r.applied_at,
      pendingCount: r.pending_count,
    }));
  }

  insertIfAbsent(n: NewInboxNotification): void {
    this.db
      .prepare(
        `INSERT INTO notifications (
           id, user_id, kind, category, title, body,
           tournament_id, entry_id, dedupe_key, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(dedupe_key) DO NOTHING`,
      )
      .run(
        randomUUID(),
        n.userId,
        n.kind,
        n.category,
        n.title,
        n.body,
        n.tournamentId,
        n.entryId,
        n.dedupeKey,
        n.createdAt,
      );
  }

  upsertOpen(n: NewInboxNotification): void {
    // 解消済みの通知が再び未定になった場合は、未読に戻して再通知する。
    this.db
      .prepare(
        `INSERT INTO notifications (
           id, user_id, kind, category, title, body,
           tournament_id, entry_id, dedupe_key, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(dedupe_key) DO UPDATE SET
           title = excluded.title,
           body = excluded.body,
           is_read = CASE WHEN notifications.resolved_at IS NOT NULL THEN 0 ELSE notifications.is_read END,
           resolved_at = NULL`,
      )
      .run(
        randomUUID(),
        n.userId,
        n.kind,
        n.category,
        n.title,
        n.body,
        n.tournamentId,
        n.entryId,
        n.dedupeKey,
        n.createdAt,
      );
  }

  resolveMissing(
    kind: NewInboxNotification["kind"],
    activeKeys: string[],
    userId?: string,
  ): void {
    const open = this.db
      .prepare(
        `SELECT dedupe_key FROM notifications
          WHERE kind = ? AND resolved_at IS NULL AND (? IS NULL OR user_id = ?)`,
      )
      .all(kind, userId ?? null, userId ?? null) as Array<{
      dedupe_key: string;
    }>;
    const active = new Set(activeKeys);
    const update = this.db.prepare(
      `UPDATE notifications SET resolved_at = ${NOW_JST}, is_read = 1 WHERE dedupe_key = ?`,
    );
    for (const row of open) {
      if (!active.has(row.dedupe_key)) update.run(row.dedupe_key);
    }
  }

  listByUser(userId: string): InboxNotification[] {
    const rows = this.db
      .prepare(
        `SELECT id, user_id, kind, category, title, body, tournament_id, entry_id,
                is_read, resolved_at, created_at
           FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC, id`,
      )
      .all(userId) as unknown as NotificationRow[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      category: r.category,
      title: r.title,
      body: r.body,
      tournamentId: r.tournament_id,
      entryId: r.entry_id,
      isRead: r.is_read === 1,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
    }));
  }

  countUnread(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM notifications
          WHERE user_id = ? AND is_read = 0 AND resolved_at IS NULL`,
      )
      .get(userId) as { c: number };
    return row.c;
  }

  markRead(userId: string, notificationId: string): void {
    this.db
      .prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
      .run(notificationId, userId);
  }

  markAllRead(userId: string): void {
    this.db
      .prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`)
      .run(userId);
  }
}
