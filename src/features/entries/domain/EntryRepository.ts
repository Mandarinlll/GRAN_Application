// entries / entry_members / waitlists / cancellations の永続化抽象
// （oop-architecture.md §2.4）。
//
// インターフェースをドメイン層に、実装（SqliteEntryRepository）をインフラ層に置く（依存性逆転）。
// 現行 entryRepository.ts の全 11 公開関数を漏れなく写像したもの。トランザクション付き関数
// （createConfirmedEntry / createWaitlist / cancelEntry / replaceEntryMembers）は
// Application Service の UoW へ移し、ここでは単一操作へ分解する（Repository は BEGIN しない）。
//
// エンティティを返すメソッド（findById）と DTO を返すメソッド（listMembers / listSummaries）を
// 明示的に区別する（§2.4・Finding 1・2）。純粋な型モジュール types/ は import してよい。

import type {
  EntryMemberView,
  EntrySummary,
  EntryStatus,
  ListSummaryParams,
} from "@/features/entries/types/entry";
import type { Entry } from "@/features/entries/domain/Entry";
import type { EntryMember } from "@/features/entries/domain/EntryMember";
import type { Waitlist } from "@/features/entries/domain/Waitlist";
import type { Cancellation } from "@/features/entries/domain/Cancellation";

export interface EntryRepository {
  // --- 参照系 ---
  findById(entryId: string): Entry | null; // ← findEntryById
  hasActiveEntry(
    tournamentId: string,
    userId: string,
    teamId: string | null,
  ): boolean; // ← 同名
  findSameDayActiveEntryTitles(
    eventDate: string,
    userId: string,
    teamId: string | null,
    excludeTournamentId: string,
  ): string[]; // ← findSameDayActiveEntries
  listMembers(entryId: string): EntryMemberView[]; // ← listEntryMembers（読み取りビュー DTO）
  listSummaries(params: ListSummaryParams): EntrySummary[]; // ← listEntrySummaries（DTO。members は EntryMemberView[]）
  listInvolvedTournamentIds(params: {
    userId: string;
    teamId: string | null;
  }): Set<string>; // ← 同名
  countConfirmed(tournamentId: string): number; // ★新設（確定数 COUNT）
  countActiveWaitlist(tournamentId: string): number; // ← 同名
  // --- 確定エントリー（UoW 内で呼ばれる単一操作へ分解） ---
  // insertConfirmed は採番した entries.id を返す（完了画面・通知で現行どおり使うため）。
  insertConfirmed(entry: Entry, members: EntryMember[]): string; // ← createConfirmedEntry の INSERT 部
  updateStatus(entryId: string, status: EntryStatus): void; // ← cancelEntry の UPDATE 部
  replaceMembers(entryId: string, members: EntryMember[]): void; // ← replaceEntryMembers
  insertCancellation(cancellation: Cancellation): void; // ← cancelEntry の cancellations INSERT 部
  // --- キャンセル待ち（同居） ---
  hasActiveWaitlist(
    tournamentId: string,
    userId: string,
    teamId: string | null,
  ): boolean; // ← createWaitlist の重複判定部
  nextQueueNumber(tournamentId: string): number; // ★新設（MAX(queue_number)+1）
  insertWaitlist(waitlist: Waitlist): void; // ← createWaitlist の INSERT 部
}
