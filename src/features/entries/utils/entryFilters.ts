// 「申込中・エントリー済み大会」に表示する対象かどうかの判定と、大会数の集計。
// 開催前で、キャンセル済み・参加済みでないものだけを対象にする（終了した大会は履歴として出さない）。
import type { EntrySummary } from "@/features/entries/types/entry";

export function isActiveEntry(e: EntrySummary): boolean {
  return !e.isPast && e.kind !== "ATTENDED" && e.kind !== "CANCELLED";
}

// 対象エントリーの、重複を除いた大会数。
export function countActiveTournaments(entries: EntrySummary[]): number {
  return new Set(entries.filter(isActiveEntry).map((e) => e.tournamentId)).size;
}