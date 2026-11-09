// notification_logs テーブルへのアクセスの薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.4 / §5）に伴い、SQL は
// notifications/infrastructure/SqliteNotificationRepository へ移設した。本モジュールは、まだ
// OOP 化前の呼び出し元（entries の actions.ts が COMMIT 後の通知記録に logNotification を参照）を
// 壊さないための薄い委譲ラッパとして、logNotification と関連型を残置する（SQL はこの層に残さない）。

import { db } from "@/lib/db";
import { SqliteNotificationRepository } from "@/features/notifications/infrastructure/SqliteNotificationRepository";
import type {
  LogNotificationParams,
  NotificationType,
} from "@/features/notifications/domain/NotificationRepository";

export type { LogNotificationParams, NotificationType };

const repository = new SqliteNotificationRepository(db);

// 通知ログを1件記録する（スタブ: 実送信はしない）。
export function logNotification(params: LogNotificationParams): void {
  repository.logNotification(params);
}
