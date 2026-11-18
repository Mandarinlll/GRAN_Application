// 管理者向け大会管理の型定義（design.md「型の要点」準拠）。

import type {
  Tournament,
  TournamentCategory,
  TournamentStatus,
  TournamentTier,
} from "./tournament";

// 入金状況（entries.payment_status）
export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type TournamentSurface = "HARD" | "CLAY" | "ARTIFICIAL_GRASS" | "OTHER";
export type TournamentGenderDivision = "MEN" | "WOMEN" | "MIXED";

// tournaments 1 行（管理者向け）。既存 Tournament に prize / surface / seriesId / genderDivision を加えたもの。
export interface AdminTournament extends Tournament {
  prize: string | null;
  surface: TournamentSurface | null;
  seriesId: string | null;
  genderDivision: TournamentGenderDivision | null;
}

// 検証済み・正規化済みの保存用入力（Requirement 3 の項目）
export interface TournamentInput {
  title: string;
  eventDate: string; // YYYY-MM-DD
  category: TournamentCategory;
  tier: TournamentTier;
  venue: string;
  capacity: number;
  entryFee: number;
  startTime: string; // HH:mm
  entryStartAt: string; // "YYYY-MM-DD HH:mm:00"
  entryEndAt: string; // "YYYY-MM-DD HH:mm:00"
  description: string | null;
  endTime: string | null;
  prize: string | null;
  courtInfo: string | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  alertThreshold: number | null;
  surface: AdminTournament["surface"];
  seriesId: string | null;
  genderDivision: AdminTournament["genderDivision"];
}

export type FieldErrors = Partial<
  Record<keyof TournamentInput | "image" | "form", string>
>;

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT_STALE"
  | "FORBIDDEN_TRANSITION"
  | "LOCKED_FIELD"
  | "CAPACITY_BELOW_CONFIRMED"
  | "ALREADY_UPDATED"
  | "HAS_ENTRIES"
  | "HAS_COPIES"
  | "NOT_DRAFT"
  | "IMAGE"
  | "DB_ERROR";

export type ServiceResult<T = unknown> =
  | { ok: true; data: T; warning?: string }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      fieldErrors?: FieldErrors;
      // IMAGE のとき 413（サイズ超過）/ 415（形式違反）を伝える。
      httpStatus?: number;
    };

// 一覧の 1 行（確定エントリー数 = entries.status 'CONFIRMED' のみ）
export interface AdminTournamentListRow {
  id: string;
  title: string;
  eventDate: string;
  category: TournamentCategory;
  tier: TournamentTier;
  status: TournamentStatus;
  venue: string;
  capacity: number;
  confirmedCount: number;
  entryFee: number;
  entryStartAt: string;
  alertThreshold: number | null;
}

// 詳細画面の統計。各値は個別に取得し、失敗を許容する（Requirement 11.8）。
export type StatResult<T> = { ok: true; value: T } | { ok: false };

export interface AdminTournamentStats {
  confirmedCount: StatResult<number>;
  waitingCount: StatResult<number>;
  billingCancellationCount: StatResult<number>; // 請求中のキャンセル
  paidCount: StatResult<number>; // CONFIRMED/ATTENDED のうち PAID
  unpaidCount: StatResult<number>; // CONFIRMED/ATTENDED のうち UNPAID
}

// 中止確認ダイアログ用の 4 件数
export interface CancelImpact {
  confirmedCount: number;
  waitingCount: number;
  billingCancellationCount: number;
  paidCount: number;
}

// 中止時の通知結果
export interface ChangeStatusData {
  status: TournamentStatus;
  updatedAt: string;
  notify?: { total: number; failed: number };
}

// 一括登録プレビューの 1 行（行番号は 1 始まり）
export interface PreviewRow {
  rowNumber: number;
  input: TournamentInput;
}
