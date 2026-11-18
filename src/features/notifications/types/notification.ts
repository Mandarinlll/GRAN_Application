// アプリ内通知（notifications テーブル）の型定義。

// 通知種別。
//  - REMINDER_7DAYS: 参加予定大会の7日前 9:00 のリマインド
//  - MEMBER_ASSIGN : 未定枠のまま残っている出場メンバーの指定依頼
//  - TEAM_INVITE   : 代表者からのチーム招待（refId = team_invitations.id）
export type InboxKind =
  | "REMINDER_7DAYS"
  | "MEMBER_ASSIGN"
  | "TEAM_INVITE"
  | "ANNOUNCEMENT" // 運営からのお知らせ（対応不要）
  | "URGENT"; // 運営からの緊急連絡（対応不要）

// 画面表示用の通知1件。
export interface InboxNotification {
  id: string;
  kind: InboxKind;
  tournamentId: string | null;
  entryId: string | null;
  // 種別ごとの参照ID（TEAM_INVITE のとき招待ID）。
  refId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  // 対応済み（MEMBER_ASSIGN で未定枠が解消された等）。
  isResolved: boolean;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS"（JST）
}
