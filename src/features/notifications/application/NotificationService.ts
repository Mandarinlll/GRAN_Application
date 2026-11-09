// 通知ログ記録のアプリケーションサービス（oop-architecture.md §2.5）。
//
// NotificationRepository を注入し、イベント発生時の通知ログ記録を調整する。
// 実送信（メール・Webプッシュ）は現状スタブで、記録のみを行う。
// "use server" を持たない純 TypeScript クラスとする。

import type {
  LogNotificationParams,
  NotificationRepository,
} from "@/features/notifications/domain/NotificationRepository";

export class NotificationService {
  constructor(private readonly notifications: NotificationRepository) {}

  // 通知ログを1件記録する（COMMIT 後にアダプタ層から呼ばれる）。
  log(input: LogNotificationParams): void {
    this.notifications.logNotification(input);
  }
}
