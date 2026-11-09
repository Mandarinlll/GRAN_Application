// NotificationRepository の SQLite 実装（oop-architecture.md §2.4）。
// SQL はこの層にのみ閉じ込める（既存規約 §6）。
//
// 現行 notifications/server/notificationRepository.ts の logNotification INSERT を 1:1 で移植した。
// 本実装では通知の「実送信」は行わない（スタブ）。将来 Resend 等の実送信を追加する際は、
// この層の内部で送信処理を呼び出し、成否を status / error_message に反映する形へ拡張する。

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { NOW_JST } from "@/lib/db";
import type {
  LogNotificationParams,
  NotificationRepository,
} from "@/features/notifications/domain/NotificationRepository";

export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private readonly db: DatabaseSync) {}

  logNotification(params: LogNotificationParams): void {
    this.db
      .prepare(
        `INSERT INTO notification_logs (
          id, delivery_type, user_id, recipient_email, tournament_id, entry_id,
          message_payload, status, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ${NOW_JST})`,
      )
      .run(
        randomUUID(),
        params.deliveryType,
        params.userId ?? null,
        params.recipientEmail ?? null,
        params.tournamentId ?? null,
        params.entryId ?? null,
        params.messagePayload,
      );
  }
}
