// notification_logs テーブルへのアクセスを集約するリポジトリ。
//
// 本実装では通知の「実送信」（メール・Webプッシュ）は行わない（スタブ）。
// 代わりに、送信すべきイベント発生時に必ずこのログを記録する
// （コーディング規約 6.2 の監査・通知ログ記録義務）。
// 将来 Resend 等の実送信を追加する際は、この層の内部で送信処理を呼び出し、
// 成否を status / error_message に反映する形へ拡張する。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";

// 通知配信種別（notification_type_enum）。
export type NotificationType =
  | "ENTRY_CONFIRMED"
  | "CANCEL_FREE"
  | "CANCEL_PAID_USER"
  | "CANCEL_PAID_ADMIN"
  | "WAITLIST_OFFER"
  | "REMINDER_10DAYS"
  | "CAPACITY_ALERT"
  | "URGENT_BROADCAST";

export interface LogNotificationParams {
  deliveryType: NotificationType;
  userId?: string | null;
  recipientEmail?: string | null;
  tournamentId?: string | null;
  entryId?: string | null;
  messagePayload: string;
}

// 通知ログを1件記録する（スタブ: 実送信はしない）。
export function logNotification(params: LogNotificationParams): void {
  db.prepare(
    `INSERT INTO notification_logs (
      id, delivery_type, user_id, recipient_email, tournament_id, entry_id,
      message_payload, status, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ${NOW_JST})`,
  ).run(
    randomUUID(),
    params.deliveryType,
    params.userId ?? null,
    params.recipientEmail ?? null,
    params.tournamentId ?? null,
    params.entryId ?? null,
    params.messagePayload,
  );
}
