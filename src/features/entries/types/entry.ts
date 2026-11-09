// エントリー（entries）・キャンセル・キャンセル待ちドメインの型定義。
// DB ENUM と同期したリテラル型（コーディング規約 3.3 / db-schema.md 準拠）。

import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// エントリーステータス（entry_status_enum）
export type EntryStatus =
  | "CONFIRMED" // 確定
  | "WAITING" // キャンセル待ち（entries 側には使わず waitlists を正とするが型として保持）
  | "CANCELLED" // キャンセル済
  | "ATTENDED"; // 大会参加完了

// エントリーメンバー種別（member_type_enum）
export type MemberType =
  | "REGISTERED" // アプリ登録ユーザー
  | "GUEST" // ゲスト枠（氏名入力）
  | "PENDING"; // 未定枠（後日割当）

// キャンセル待ちステータス（waitlist_status_enum）
export type WaitlistStatus =
  | "WAITING"
  | "OFFERED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED";

// 管理者キャンセル対応ステータス（cancellation_admin_status_enum）
export type CancellationAdminStatus =
  | "NOT_REQUIRED"
  | "UNCONTACTED"
  | "IN_CONSULTATION"
  | "PAID_CONFIRMED"
  | "WAIVED";

// entries テーブル1行に対応するアプリ内部表現。
export interface Entry {
  id: string;
  tournamentId: string;
  userId: string;
  teamId: string | null;
  category: TournamentCategory;
  status: EntryStatus;
  isProxy: boolean;
  appliedAt: string;
  createdAt: string;
  updatedAt: string;
}

// entry_members テーブル1行に対応するアプリ内部表現。
export interface EntryMember {
  id: string;
  entryId: string;
  memberType: MemberType;
  userId: string | null;
  guestName: string | null;
  isPending: boolean;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
}

// EntrySummary.members 用の読み取り専用 DTO（oop-architecture.md §2.1・Finding 1）。
// 現行 EntryMember interface のフィールドを 1:1 で引き継ぐ（名前変更のみ・形は不変）。
// "use server" 境界を越える読み取りビュー値であり、書き込み系エンティティ
// （entries/domain/EntryMember.ts の EntryMember クラス）とは別物として一意化する。
export interface EntryMemberView {
  id: string;
  entryId: string;
  memberType: MemberType;
  userId: string | null;
  guestName: string | null;
  isPending: boolean;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
}

// listSummaries の引数（oop-architecture.md §2.4）。
// 現行 listEntrySummaries のインライン型を 1:1 で名前付き化したもの。
// teamId は personal スコープでは省略（現行と同一の呼び出し形）。
export interface ListSummaryParams {
  userId: string;
  teamId?: string | null;
  scope: "personal" | "team";
}

// waitlists テーブル1行に対応するアプリ内部表現。
export interface Waitlist {
  id: string;
  tournamentId: string;
  userId: string;
  teamId: string | null;
  queueNumber: number;
  status: WaitlistStatus;
  offeredAt: string | null;
  acceptDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

// cancellations テーブル1行に対応するアプリ内部表現。
export interface Cancellation {
  id: string;
  entryId: string;
  cancelledAt: string;
  daysBefore: number;
  feeRate: 0 | 50 | 100;
  feeAmount: number;
  isPaid: boolean;
  adminStatus: CancellationAdminStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// 「自チーム申込中・エントリー済み一覧」や、マイスケジュール表示に使うビューモデル。
// 大会情報の一部とエントリー情報を結合したもの。
export interface EntrySummary {
  entryId: string;
  tournamentId: string;
  tournamentTitle: string;
  tournamentDisplayId: string; // 画面表示用 ID（tournaments.id）
  eventDate: string;
  startTime: string;
  venue: string;
  category: TournamentCategory;
  tier: TournamentTier;
  entryFee: number;
  // エントリー種別の表示用状態。CONFIRMED/CANCELLED/ATTENDED or WAITING(キャンセル待ち)。
  kind: "CONFIRMED" | "WAITING" | "CANCELLED" | "ATTENDED";
  status: EntryStatus | "WAITING";
  queueNumber: number | null; // キャンセル待ちの順位（WAITING時のみ）
  isTeamEntry: boolean; // チームとしてのエントリーか（個人エントリーなら false）
  teamName: string | null;
  isPast: boolean; // 開催日が過去か
  hasPendingMember: boolean; // 未定枠が残っているか（要メンバー登録表示用）
  members: EntryMemberView[]; // メンバー構成（読み取り専用 DTO。クラスを境界越えさせない）
}
