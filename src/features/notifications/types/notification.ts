// アプリ内通知（notifications テーブル）の型定義。

// 通知種別。
//  - REMINDER_7DAYS: 参加予定大会の7日前 9:00 のリマインド
//  - MEMBER_ASSIGN : 未定枠のまま残っている出場メンバーの指定依頼
export type InboxKind = "REMINDER_7DAYS" | "MEMBER_ASSIGN";

// 画面表示用の通知1件。
export interface InboxNotification {
  id: string;
  kind: InboxKind;
  tournamentId: string | null;
  entryId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  // 対応済み（MEMBER_ASSIGN で未定枠が解消された等）。
  isResolved: boolean;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS"（JST）
}
