// 管理者向けエントリー状況の DTO。
// 個人情報は氏名（realName）と読み仮名（kanaName）のみ。
// email / phone / birthDate / loginId は含めない（Requirement 14.25）。

import type {
  CancellationAdminStatus,
  EntryStatus,
  WaitlistStatus,
} from "@/features/entries/types/entry";
import type { PaymentStatus } from "./adminTournament";

export interface EntryStatusQuery {
  status?: EntryStatus;
  payment?: PaymentStatus;
  q?: string; // 100 文字以内
  pageEntries: number;
  pageWaitlist: number;
  pageCancellations: number;
}

// 部分失敗を表現する。失敗した部分だけ { ok: false }。
export type Section<T> = { ok: true; data: T } | { ok: false; message: string };

export interface PagedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number; // 20
}

// 絞り込みに関係なく、大会全体の件数（Requirement 14.20、14.33）
export interface EntryCounts {
  byStatus: Record<EntryStatus, number>;
  byPayment: Record<PaymentStatus, number>;
}

export interface EntryRowDto {
  id: string;
  status: EntryStatus;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  isProxy: boolean;
  appliedAt: string;
  realName: string;
  kanaName: string | null;
  teamName: string | null;
}

export interface WaitlistRowDto {
  id: string;
  queueNumber: number;
  status: WaitlistStatus;
  realName: string;
  kanaName: string | null;
  teamName: string | null;
}

export interface CancellationRowDto {
  id: string;
  entryId: string;
  cancelledAt: string;
  isPaid: boolean;
  feeAmount: number;
  adminStatus: CancellationAdminStatus;
  realName: string;
  kanaName: string | null;
  teamName: string | null;
}

export interface EntryStatusView {
  tournamentId: string;
  counts: Section<EntryCounts>;
  entries: Section<PagedList<EntryRowDto>>;
  waitlist: Section<PagedList<WaitlistRowDto>>;
  cancellations: Section<PagedList<CancellationRowDto>>;
}
