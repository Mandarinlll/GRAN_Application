// エントリー状況画面の表示ラベル。
import type {
  CancellationAdminStatus,
  EntryStatus,
  WaitlistStatus,
} from "@/features/entries/types/entry";
import type { PaymentStatus } from "@/features/tournaments/types/adminTournament";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "未入金",
  PAID: "入金済み",
  REFUNDED: "返金済み",
};

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  CONFIRMED: "確定",
  WAITING: "キャンセル待ち",
  CANCELLED: "キャンセル",
  ATTENDED: "出席済み",
};

export const WAITLIST_STATUS_LABEL: Record<WaitlistStatus, string> = {
  WAITING: "待機中",
  OFFERED: "繰り上げ案内中",
  ACCEPTED: "承諾",
  DECLINED: "辞退",
  EXPIRED: "期限切れ",
};

export const CANCEL_ADMIN_STATUS_LABEL: Record<CancellationAdminStatus, string> = {
  NOT_REQUIRED: "対応不要",
  UNCONTACTED: "未連絡",
  IN_CONSULTATION: "相談中",
  PAID_CONFIRMED: "入金確認済み",
  WAIVED: "請求取り下げ",
};
