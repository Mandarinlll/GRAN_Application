// ステータス → 画面表示ラベルの単一の真実の源（Single Source of Truth）。
//
// 従来は各ページ / コンポーネントに「空き枠あり」「残りわずか」「満員 (キャンセル待ち)」
// や、エントリー種別の「確定」「キャンセル済」などの日本語ラベルがインライン散在しており、
// 画面ごとに文言がぶれる一貫性の問題があった。本モジュールへ集約し、
// ドメインのリテラル型（CapacityStatus / EntryStatus 等）をキーにした網羅的な
// Record として一元管理する（コーディング規約 §1.2 の共有昇格先 = ルート components）。
//
// キーにリテラル型を使うことで、ENUM 値が増減した場合に型エラーで検知でき、
// ラベル定義漏れ・重複を防ぐ。
//
// 注意: Server Action の外部契約として保持される文言（actions.ts の toActionResult
// が返すエラーメッセージ等）はここには含めない。本モジュールは「提示レイヤーの
// 表示ラベル」のみを扱う。

import type { CapacityStatus } from "@/features/tournaments/utils/capacity";
import type {
  EntryStatus,
  WaitlistStatus,
} from "@/features/entries/types/entry";

// 大会ステータス / 種目 / 階級のラベルは、既に DB ENUM と同期した型定義の近傍
// （tournaments/types/tournament.ts）に単一定義があるため、そこを唯一の源とし、
// アプリ全体の共通参照点として本モジュールから再エクスポートする（二重定義しない）。
export {
  CATEGORY_LABEL,
  TIER_LABEL,
  STATUS_LABEL as TOURNAMENT_STATUS_LABEL,
} from "@/features/tournaments/types/tournament";

// EntrySummary.kind の表示用状態（確定 / キャンセル待ち / キャンセル済 / 参加完了）。
// entries/types/entry.ts の EntrySummary["kind"] と同じ集合。
export type EntryKind = "CONFIRMED" | "WAITING" | "CANCELLED" | "ATTENDED";

// 空き枠ステータス → 日本語表示名。
// 文言は規約 §4.3 の CapacityBadge サンプル（正）と一致させる。
export const CAPACITY_STATUS_LABEL: Record<CapacityStatus, string> = {
  OPEN: "空き枠あり",
  FEW: "残りわずか",
  FULL: "満員 (キャンセル待ち)",
};

// エントリー種別 → 日本語表示名（バッジ等の提示用）。
export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  CONFIRMED: "確定",
  WAITING: "キャンセル待ち",
  CANCELLED: "キャンセル済",
  ATTENDED: "参加完了",
};

// エントリーステータス（entry_status_enum）→ 日本語表示名。
// EntryStatus は EntryKind と同じ 4 値だが、型としては別物のため網羅性を独立に担保する。
export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  CONFIRMED: "確定",
  WAITING: "キャンセル待ち",
  CANCELLED: "キャンセル済",
  ATTENDED: "参加完了",
};

// キャンセル待ちステータス（waitlist_status_enum）→ 日本語表示名。
export const WAITLIST_STATUS_LABEL: Record<WaitlistStatus, string> = {
  WAITING: "キャンセル待ち",
  OFFERED: "繰り上げ案内中",
  ACCEPTED: "繰り上げ確定",
  DECLINED: "辞退",
  EXPIRED: "期限切れ",
};
