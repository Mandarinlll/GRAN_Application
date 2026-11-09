// EntryRepository の SQLite 実装（oop-architecture.md §2.4）。
// SQL はこの層にのみ閉じ込める（既存規約 §6）。
//
// 現行 entryRepository.ts の SQL・行→エンティティ変換（toEntry/toEntryMember/toWaitlist/
// toCancellation）を 1:1 で移植した。トランザクション付き関数は単一操作へ分解し、
// BEGIN IMMEDIATE はこの層から排した（原子性は Application Service の UoW が担う・§6）。

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { NOW_JST } from "@/lib/db";
import type {
  EntryMemberView,
  EntrySummary,
  EntryStatus,
  ListSummaryParams,
  MemberType,
  WaitlistStatus,
} from "@/features/entries/types/entry";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";
import { isPastDate } from "@/utils/date";
import type { EntryRepository } from "@/features/entries/domain/EntryRepository";
import { Entry } from "@/features/entries/domain/Entry";
import type { EntryMember } from "@/features/entries/domain/EntryMember";
import type { Waitlist } from "@/features/entries/domain/Waitlist";
import type { Cancellation } from "@/features/entries/domain/Cancellation";

interface EntryRow {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  category: TournamentCategory;
  status: EntryStatus;
  is_proxy: number;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

interface EntryMemberRow {
  id: string;
  entry_id: string;
  member_type: MemberType;
  user_id: string | null;
  guest_name: string | null;
  is_pending: number;
  order_no: number;
  created_at: string;
  updated_at: string;
}

interface WaitlistRow {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  queue_number: number;
  status: WaitlistStatus;
  offered_at: string | null;
  accept_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteEntryRepository implements EntryRepository {
  constructor(private readonly db: DatabaseSync) {}

  // -------------------- 行 → エンティティ / DTO 変換（private） --------------------

  private toEntry(row: EntryRow): Entry {
    return new Entry(
      row.id,
      row.tournament_id,
      row.user_id,
      row.team_id,
      row.category,
      row.status,
      row.is_proxy === 1,
      row.applied_at,
      row.created_at,
      row.updated_at,
    );
  }

  private toEntryMemberView(row: EntryMemberRow): EntryMemberView {
    return {
      id: row.id,
      entryId: row.entry_id,
      memberType: row.member_type,
      userId: row.user_id,
      guestName: row.guest_name,
      isPending: row.is_pending === 1,
      orderNo: row.order_no,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // -------------------- 参照系 --------------------

  findById(entryId: string): Entry | null {
    const row = this.db
      .prepare("SELECT * FROM entries WHERE id = ?")
      .get(entryId) as EntryRow | undefined;
    return row ? this.toEntry(row) : null;
  }

  hasActiveEntry(
    tournamentId: string,
    userId: string,
    teamId: string | null,
  ): boolean {
    if (teamId) {
      const row = this.db
        .prepare(
          `SELECT 1 FROM entries
            WHERE tournament_id = ? AND team_id = ?
              AND status IN ('CONFIRMED','ATTENDED') LIMIT 1`,
        )
        .get(tournamentId, teamId);
      return row !== undefined;
    }
    const row = this.db
      .prepare(
        `SELECT 1 FROM entries
          WHERE tournament_id = ? AND user_id = ? AND team_id IS NULL
            AND status IN ('CONFIRMED','ATTENDED') LIMIT 1`,
      )
      .get(tournamentId, userId);
    return row !== undefined;
  }

  findSameDayActiveEntryTitles(
    eventDate: string,
    userId: string,
    teamId: string | null,
    excludeTournamentId: string,
  ): string[] {
    const rows = this.db
      .prepare(
        `SELECT t.title AS title
           FROM entries e
           JOIN tournaments t ON t.id = e.tournament_id
          WHERE t.event_date = ?
            AND e.tournament_id != ?
            AND e.status IN ('CONFIRMED','ATTENDED')
            AND (
              (? IS NOT NULL AND e.team_id = ?)
              OR (? IS NULL AND e.user_id = ? AND e.team_id IS NULL)
            )`,
      )
      .all(
        eventDate,
        excludeTournamentId,
        teamId,
        teamId,
        teamId,
        userId,
      ) as Array<{ title: string }>;
    return rows.map((r) => r.title);
  }

  listMembers(entryId: string): EntryMemberView[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM entry_members WHERE entry_id = ? ORDER BY order_no ASC",
      )
      .all(entryId) as EntryMemberRow[];
    return rows.map((r) => this.toEntryMemberView(r));
  }

  listSummaries(params: ListSummaryParams): EntrySummary[] {
    const { userId, teamId, scope } = params;

    let where: string;
    const args: string[] = [];
    if (scope === "team") {
      if (!teamId) return [];
      where = "e.team_id = ?";
      args.push(teamId);
    } else {
      where = "e.user_id = ? AND e.team_id IS NULL";
      args.push(userId);
    }

    const entryRows = this.db
      .prepare(
        `SELECT e.*, t.title AS t_title, t.event_date AS t_event_date,
                t.start_time AS t_start_time, t.venue AS t_venue,
                t.tier AS t_tier, t.entry_fee AS t_entry_fee,
                tm.name AS team_name
           FROM entries e
           JOIN tournaments t ON t.id = e.tournament_id
           LEFT JOIN teams tm ON tm.id = e.team_id
          WHERE ${where}
          ORDER BY t.event_date ASC`,
      )
      .all(...args) as Array<
      EntryRow & {
        t_title: string;
        t_event_date: string;
        t_start_time: string;
        t_venue: string;
        t_tier: TournamentTier;
        t_entry_fee: number;
        team_name: string | null;
      }
    >;

    const summaries: EntrySummary[] = entryRows.map((row) => {
      const members = this.listMembers(row.id);
      const hasPending = members.some((m) => m.isPending);
      return {
        entryId: row.id,
        tournamentId: row.tournament_id,
        tournamentTitle: row.t_title,
        tournamentDisplayId: row.tournament_id,
        eventDate: row.t_event_date,
        startTime: row.t_start_time,
        venue: row.t_venue,
        category: row.category,
        tier: row.t_tier,
        entryFee: row.t_entry_fee,
        kind:
          row.status === "CONFIRMED"
            ? "CONFIRMED"
            : row.status === "ATTENDED"
              ? "ATTENDED"
              : "CANCELLED",
        status: row.status,
        queueNumber: null,
        isTeamEntry: row.team_id !== null,
        teamName: row.team_name,
        isPast: isPastDate(row.t_event_date),
        hasPendingMember: hasPending,
        members,
      };
    });

    // キャンセル待ち（waitlists）も同じ一覧に混ぜて表示する。
    let waitWhere: string;
    const waitArgs: string[] = [];
    if (scope === "team") {
      if (!teamId) return summaries;
      waitWhere = "w.team_id = ?";
      waitArgs.push(teamId);
    } else {
      waitWhere = "w.user_id = ? AND w.team_id IS NULL";
      waitArgs.push(userId);
    }

    const waitRows = this.db
      .prepare(
        `SELECT w.*, t.title AS t_title, t.event_date AS t_event_date,
                t.start_time AS t_start_time, t.venue AS t_venue,
                t.tier AS t_tier, t.entry_fee AS t_entry_fee, t.category AS t_category,
                tm.name AS team_name
           FROM waitlists w
           JOIN tournaments t ON t.id = w.tournament_id
           LEFT JOIN teams tm ON tm.id = w.team_id
          WHERE ${waitWhere} AND w.status IN ('WAITING','OFFERED')
          ORDER BY t.event_date ASC`,
      )
      .all(...waitArgs) as Array<
      WaitlistRow & {
        t_title: string;
        t_event_date: string;
        t_start_time: string;
        t_venue: string;
        t_tier: TournamentTier;
        t_entry_fee: number;
        t_category: TournamentCategory;
        team_name: string | null;
      }
    >;

    for (const w of waitRows) {
      summaries.push({
        entryId: w.id,
        tournamentId: w.tournament_id,
        tournamentTitle: w.t_title,
        tournamentDisplayId: w.tournament_id,
        eventDate: w.t_event_date,
        startTime: w.t_start_time,
        venue: w.t_venue,
        category: w.t_category,
        tier: w.t_tier,
        entryFee: w.t_entry_fee,
        kind: "WAITING",
        status: "WAITING",
        queueNumber: w.queue_number,
        isTeamEntry: w.team_id !== null,
        teamName: w.team_name,
        isPast: isPastDate(w.t_event_date),
        hasPendingMember: false,
        members: [],
      });
    }

    return summaries;
  }

  listInvolvedTournamentIds(params: {
    userId: string;
    teamId: string | null;
  }): Set<string> {
    const { userId, teamId } = params;
    const ids = new Set<string>();

    const entryRows = this.db
      .prepare(
        `SELECT DISTINCT tournament_id FROM entries
          WHERE status IN ('CONFIRMED','ATTENDED')
            AND (
              (user_id = ? AND team_id IS NULL)
              OR (? IS NOT NULL AND team_id = ?)
            )`,
      )
      .all(userId, teamId, teamId) as Array<{ tournament_id: string }>;
    for (const r of entryRows) ids.add(r.tournament_id);

    const waitRows = this.db
      .prepare(
        `SELECT DISTINCT tournament_id FROM waitlists
          WHERE status IN ('WAITING','OFFERED')
            AND (
              (user_id = ? AND team_id IS NULL)
              OR (? IS NOT NULL AND team_id = ?)
            )`,
      )
      .all(userId, teamId, teamId) as Array<{ tournament_id: string }>;
    for (const r of waitRows) ids.add(r.tournament_id);

    return ids;
  }

  countConfirmed(tournamentId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM entries
          WHERE tournament_id = ? AND status IN ('CONFIRMED','ATTENDED')`,
      )
      .get(tournamentId) as { c: number };
    return row.c;
  }

  countActiveWaitlist(tournamentId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM waitlists
          WHERE tournament_id = ? AND status IN ('WAITING','OFFERED')`,
      )
      .get(tournamentId) as { c: number };
    return row.c;
  }

  // -------------------- 確定エントリー（単一操作・BEGIN しない） --------------------

  insertConfirmed(entry: Entry, members: EntryMember[]): string {
    const entryId = randomUUID();
    this.db
      .prepare(
        `INSERT INTO entries (
          id, tournament_id, user_id, team_id, category, status, is_proxy,
          applied_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ${NOW_JST}, ${NOW_JST}, ${NOW_JST})`,
      )
      .run(
        entryId,
        entry.tournamentId,
        entry.userId,
        entry.teamId,
        entry.category,
        entry.isProxy ? 1 : 0,
      );

    this.insertMembers(entryId, members);
    return entryId;
  }

  updateStatus(entryId: string, status: EntryStatus): void {
    this.db
      .prepare(
        `UPDATE entries SET status = ?, updated_at = ${NOW_JST} WHERE id = ?`,
      )
      .run(status, entryId);
  }

  replaceMembers(entryId: string, members: EntryMember[]): void {
    this.db
      .prepare("DELETE FROM entry_members WHERE entry_id = ?")
      .run(entryId);
    this.insertMembers(entryId, members);
    this.db
      .prepare(`UPDATE entries SET updated_at = ${NOW_JST} WHERE id = ?`)
      .run(entryId);
  }

  insertCancellation(cancellation: Cancellation): void {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO cancellations (
          id, entry_id, cancelled_at, days_before, fee_rate, fee_amount,
          is_paid, admin_status, created_at, updated_at
        ) VALUES (?, ?, ${NOW_JST}, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
      )
      .run(
        id,
        cancellation.entryId,
        cancellation.daysBefore,
        cancellation.feeRate,
        cancellation.feeAmount,
        cancellation.isPaid ? 1 : 0,
        cancellation.adminStatus,
      );
  }

  // メンバー行をまとめて挿入する（呼び出し元のトランザクション前提）。
  private insertMembers(entryId: string, members: EntryMember[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO entry_members (
        id, entry_id, member_type, user_id, guest_name, is_pending, order_no,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
    );
    for (const m of members) {
      stmt.run(
        randomUUID(),
        entryId,
        m.memberType,
        m.userId,
        m.guestName,
        m.memberType === "PENDING" ? 1 : 0,
        m.orderNo,
      );
    }
  }

  // -------------------- キャンセル待ち（単一操作・BEGIN しない） --------------------

  hasActiveWaitlist(
    tournamentId: string,
    userId: string,
    teamId: string | null,
  ): boolean {
    const dup = this.db
      .prepare(
        `SELECT 1 FROM waitlists
          WHERE tournament_id = ? AND status IN ('WAITING','OFFERED')
            AND (
              (? IS NOT NULL AND team_id = ?)
              OR (? IS NULL AND user_id = ? AND team_id IS NULL)
            ) LIMIT 1`,
      )
      .get(tournamentId, teamId, teamId, teamId, userId);
    return dup !== undefined;
  }

  nextQueueNumber(tournamentId: string): number {
    const maxRow = this.db
      .prepare(
        "SELECT MAX(queue_number) AS maxNo FROM waitlists WHERE tournament_id = ?",
      )
      .get(tournamentId) as { maxNo: number | null };
    return (maxRow.maxNo ?? 0) + 1;
  }

  insertWaitlist(waitlist: Waitlist): void {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO waitlists (
          id, tournament_id, user_id, team_id, queue_number, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'WAITING', ${NOW_JST}, ${NOW_JST})`,
      )
      .run(
        id,
        waitlist.tournamentId,
        waitlist.userId,
        waitlist.teamId,
        waitlist.queueNumber,
      );
  }
}
