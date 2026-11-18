// 大会ステータスの遷移表と OPEN 遷移時の必須項目検証（純粋関数）。
// Requirement 6.2, 6.3, 6.4, 6.7。

import type { AdminTournament } from "../types/adminTournament";
import type { TournamentStatus } from "../types/tournament";

export const ALLOWED_STATUS_TRANSITIONS: Record<
  TournamentStatus,
  readonly TournamentStatus[]
> = {
  DRAFT: ["UPCOMING", "OPEN", "CANCELLED"],
  UPCOMING: ["DRAFT", "OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: ["OPEN", "FINISHED", "CANCELLED"],
  FINISHED: [],
  CANCELLED: [],
};

export function allowedNextStatuses(
  from: TournamentStatus,
): readonly TournamentStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[from] ?? [];
}

// 同一ステータスへの遷移は false。
export function canTransition(
  from: TournamentStatus,
  to: TournamentStatus,
): boolean {
  return allowedNextStatuses(from).includes(to);
}

type RequiredKey =
  | "title"
  | "eventDate"
  | "category"
  | "tier"
  | "venue"
  | "imageUrl"
  | "capacity"
  | "entryFee"
  | "startTime"
  | "entryStartAt"
  | "entryEndAt";

// Required_Fields（項目名は画面表示用の日本語）。
const REQUIRED_FIELDS: readonly { key: RequiredKey; label: string; kind: "text" | "number" }[] = [
  { key: "title", label: "大会名", kind: "text" },
  { key: "eventDate", label: "開催日", kind: "text" },
  { key: "category", label: "種目区分", kind: "text" },
  { key: "tier", label: "募集階級", kind: "text" },
  { key: "venue", label: "会場名", kind: "text" },
  { key: "imageUrl", label: "要項画像", kind: "text" },
  { key: "capacity", label: "定員数", kind: "number" },
  { key: "entryFee", label: "参加費", kind: "number" },
  { key: "startTime", label: "開始時刻", kind: "text" },
  { key: "entryStartAt", label: "受付開始日時", kind: "text" },
  { key: "entryEndAt", label: "受付締切日時", kind: "text" },
];

// 未保存（未設定・空文字・空白のみ）の Required_Fields の項目名を返す。
export function missingRequiredFields(t: Partial<AdminTournament>): string[] {
  const missing: string[] = [];
  for (const { key, label, kind } of REQUIRED_FIELDS) {
    const v: unknown = t[key];
    const ok =
      kind === "number"
        ? typeof v === "number" && Number.isFinite(v)
        : typeof v === "string" && v.trim() !== "";
    if (!ok) missing.push(label);
  }
  return missing;
}
