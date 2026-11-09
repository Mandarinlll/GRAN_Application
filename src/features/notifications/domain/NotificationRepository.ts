// notification_logs テーブルの永続化抽象（oop-architecture.md §2.4）。
//
// インターフェースをドメイン層に、実装（SqliteNotificationRepository）をインフラ層に置く。
// 通知の「実送信」（メール・Webプッシュ）は本実装では行わず、イベント発生時のログ記録に限る
// （既存規約 §6.2 の監査・通知ログ記録義務）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

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

export interface NotificationRepository {
  // 通知ログを1件記録する（スタブ: 実送信はしない）。
  logNotification(params: LogNotificationParams): void;
}
