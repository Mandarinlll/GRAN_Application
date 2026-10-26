// entries / entry_members / waitlists / cancellations テーブルへのアクセスを集約するリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6）。
//
// 定員の排他チェックやステータス整合はトランザクション内で行う
// （コーディング規約 6.1）。node:sqlite は BEGIN/COMMIT/ROLLBACK を exec で扱う。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type {
  Cancellation,
  Entry,
  EntryMember,
  EntrySummary,
  MemberType,
  Waitlist,
} from "@/features/entries/types/entry";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";
import { isPastDate } from "@/utils/date";

// -------------------- 行→ドメイン変換 --------------------

interface EntryRow {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  category: TournamentCategory;
  status: Entry["status"];
  is_proxy: number;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    teamId: row.team_id,
    category: row.category,
    status: row.status,
    isProxy: row.is_proxy === 1,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

function toEntryMember(row: EntryMemberRow): EntryMember {
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

interface WaitlistRow {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  queue_number: number;
  status: Waitlist["status"];
  offered_at: string | null;
  accept_deadline: string | null;
  created_at: string;
  updated_at: string;
}

function toWaitlist(row: WaitlistRow): Waitlist {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    teamId: row.team_id,
    queueNumber: row.queue_number,
    status: row.status,
    offeredAt: row.offered_at,
    acceptDeadline: row.accept_deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CancellationRow {
  id: string;
  entry_id: string;
  cancelled_at: string;
  days_before: number;
  fee_rate: number;
  fee_amount: number;
  is_paid: number;
  admin_status: Cancellation["adminStatus"];
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

function toCancellation(row: CancellationRow): Cancellation {
  return {
    id: row.id,
    entryId: row.entry_id,
    cancelledAt: row.cancelled_at,
    daysBefore: row.days_before,
    feeRate: row.fee_rate as 0 | 50 | 100,
    feeAmount: row.fee_amount,
    isPaid: row.is_paid === 1,
    adminStatus: row.admin_status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// -------------------- 参照系 --------------------

// 同一ユーザー（または同一チーム）が、指定大会に既にアクティブなエントリーを持つか。
// アクティブ = status が CONFIRMED / ATTENDED。重複エントリー防止に使う。
export function hasActiveEntry(
  tournamentId: string,
  userId: string,
  teamId: string | null,
): boolean {
  if (teamId) {
    const row = db
      .prepare(
        `SELECT 1 FROM entries
          WHERE tournament_id = ? AND team_id = ?
            AND status IN ('CONFIRMED','ATTENDED') LIMIT 1`,
      )
      .get(tournamentId, teamId);
    return row !== undefined;
  }
  const row = db
    .prepare(
      `SELECT 1 FROM entries
        WHERE tournament_id = ? AND user_id = ? AND team_id IS NULL
          AND status IN ('CONFIRMED','ATTENDED') LIMIT 1`,
    )
    .get(tournamentId, userId);
  return row !== undefined;
}

// 指定ユーザー / チームが「同じ開催日」に既にアクティブなエントリーを持つ大会名の配列。
// 重複排除（requirements-detail-user.md 3.1）の警告判定に使う。
// 対象大会（excludeTournamentId）自身は除外する。
export function findSameDayActiveEntries(
  eventDate: string,
  userId: string,
  teamId: string | null,
  excludeTournamentId: string,
): string[] {
  const rows = db
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

// エントリーのメンバー構成を取得する。
export function listEntryMembers(entryId: string): EntryMember[] {
  const rows = db
    .prepare(
      "SELECT * FROM entry_members WHERE entry_id = ? ORDER BY order_no ASC",
    )
    .all(entryId) as EntryMemberRow[];
  return rows.map(toEntryMember);
}

// エントリーを1件取得。
export function findEntryById(entryId: string): Entry | null {
  const row = db
    .prepare("SELECT * FROM entries WHERE id = ?")
    .get(entryId) as EntryRow | undefined;
  return row ? toEntry(row) : null;
}

// -------------------- マイスケジュール / 申込中一覧 --------------------

// ユーザー個人・ユーザーが代表のチームが関わるエントリー一覧（確定/キャンセル/参加完了）。
// scope: 'personal' = 個人エントリーのみ / 'team' = 指定チームのエントリーのみ。
export function listEntrySummaries(params: {
  userId: string;
  teamId?: string | null;
  scope: "personal" | "team";
}): EntrySummary[] {
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

  const entryRows = db
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
    const members = listEntryMembers(row.id);
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

  const waitRows = db
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

// -------------------- 作成系（エントリー申込・排他制御） --------------------

export interface CreateEntryParams {
  tournamentId: string;
  userId: string;
  teamId: string | null;
  category: TournamentCategory;
  isProxy?: boolean;
  members: Array<{
    memberType: MemberType;
    userId: string | null;
    guestName: string | null;
    orderNo: number;
  }>;
}

export type CreateEntryResult =
  | { ok: true; entry: Entry }
  | { ok: false; reason: "FULL" | "DUPLICATE" };

// エントリーを確定作成する。
// 定員チェック〜挿入をトランザクション内で行い、満員なら作成しない。
export function createConfirmedEntry(
  params: CreateEntryParams,
): CreateEntryResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    // 重複エントリー防止（同一大会に既にアクティブエントリーがある）。
    if (hasActiveEntry(params.tournamentId, params.userId, params.teamId)) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "DUPLICATE" };
    }

    // 定員の排他チェック。
    const capacityRow = db
      .prepare("SELECT capacity FROM tournaments WHERE id = ?")
      .get(params.tournamentId) as { capacity: number } | undefined;
    const capacity = capacityRow?.capacity ?? 0;
    const confirmed = db
      .prepare(
        `SELECT COUNT(*) AS c FROM entries
          WHERE tournament_id = ? AND status IN ('CONFIRMED','ATTENDED')`,
      )
      .get(params.tournamentId) as { c: number };

    if (confirmed.c >= capacity) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "FULL" };
    }

    // エントリー本体を挿入。
    const entryId = randomUUID();
    db.prepare(
      `INSERT INTO entries (
        id, tournament_id, user_id, team_id, category, status, is_proxy,
        applied_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ${NOW_JST}, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      entryId,
      params.tournamentId,
      params.userId,
      params.teamId,
      params.category,
      params.isProxy ? 1 : 0,
    );

    // メンバー構成を挿入。
    insertMembers(entryId, params.members);

    const row = db
      .prepare("SELECT * FROM entries WHERE id = ?")
      .get(entryId) as EntryRow;
    db.exec("COMMIT");
    return { ok: true, entry: toEntry(row) };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// メンバー行をまとめて挿入する（同一トランザクション前提）。
function insertMembers(
  entryId: string,
  members: CreateEntryParams["members"],
): void {
  const stmt = db.prepare(
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

// -------------------- キャンセル待ち --------------------

export type WaitlistResult =
  | { ok: true; waitlist: Waitlist }
  | { ok: false; reason: "DUPLICATE" };

// キャンセル待ちに登録する。末尾の queue_number を採番する。
export function createWaitlist(params: {
  tournamentId: string;
  userId: string;
  teamId: string | null;
}): WaitlistResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    // 既に待機中なら重複登録しない。
    const dup = db
      .prepare(
        `SELECT 1 FROM waitlists
          WHERE tournament_id = ? AND status IN ('WAITING','OFFERED')
            AND (
              (? IS NOT NULL AND team_id = ?)
              OR (? IS NULL AND user_id = ? AND team_id IS NULL)
            ) LIMIT 1`,
      )
      .get(
        params.tournamentId,
        params.teamId,
        params.teamId,
        params.teamId,
        params.userId,
      );
    if (dup !== undefined) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "DUPLICATE" };
    }

    const maxRow = db
      .prepare(
        "SELECT MAX(queue_number) AS maxNo FROM waitlists WHERE tournament_id = ?",
      )
      .get(params.tournamentId) as { maxNo: number | null };
    const queueNumber = (maxRow.maxNo ?? 0) + 1;

    const id = randomUUID();
    db.prepare(
      `INSERT INTO waitlists (
        id, tournament_id, user_id, team_id, queue_number, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'WAITING', ${NOW_JST}, ${NOW_JST})`,
    ).run(id, params.tournamentId, params.userId, params.teamId, queueNumber);

    const row = db
      .prepare("SELECT * FROM waitlists WHERE id = ?")
      .get(id) as WaitlistRow;
    db.exec("COMMIT");
    return { ok: true, waitlist: toWaitlist(row) };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ユーザー個人・所属（代表）チームがアクティブに関与している大会IDの集合を返す。
// 一覧で「自チーム申込中」バッジを出すために使う（確定エントリー + キャンセル待ち）。
export function listInvolvedTournamentIds(params: {
  userId: string;
  teamId: string | null;
}): Set<string> {
  const { userId, teamId } = params;
  const ids = new Set<string>();

  const entryRows = db
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

  const waitRows = db
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

// 大会の現在のキャンセル待ち人数（WAITING/OFFERED）。
export function countActiveWaitlist(tournamentId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM waitlists
        WHERE tournament_id = ? AND status IN ('WAITING','OFFERED')`,
    )
    .get(tournamentId) as { c: number };
  return row.c;
}

// -------------------- キャンセル --------------------

export interface CancelEntryParams {
  entryId: string;
  daysBefore: number;
  feeRate: 0 | 50 | 100;
  feeAmount: number;
  isPaid: boolean;
  adminStatus: Cancellation["adminStatus"];
}

// エントリーをキャンセルし、cancellations レコードを作成する。
// エントリーのステータス更新とキャンセル記録をトランザクションで一括実行する。
export function cancelEntry(params: CancelEntryParams): Cancellation {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE entries SET status = 'CANCELLED', updated_at = ${NOW_JST} WHERE id = ?`,
    ).run(params.entryId);

    const id = randomUUID();
    db.prepare(
      `INSERT INTO cancellations (
        id, entry_id, cancelled_at, days_before, fee_rate, fee_amount,
        is_paid, admin_status, created_at, updated_at
      ) VALUES (?, ?, ${NOW_JST}, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      id,
      params.entryId,
      params.daysBefore,
      params.feeRate,
      params.feeAmount,
      params.isPaid ? 1 : 0,
      params.adminStatus,
    );

    const row = db
      .prepare("SELECT * FROM cancellations WHERE id = ?")
      .get(id) as CancellationRow;
    db.exec("COMMIT");
    return toCancellation(row);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// -------------------- メンバー更新 --------------------

// エントリーのメンバー構成を全置換する（未定枠割当・差し替え）。
export function replaceEntryMembers(
  entryId: string,
  members: CreateEntryParams["members"],
): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM entry_members WHERE entry_id = ?").run(entryId);
    insertMembers(entryId, members);
    db.prepare(
      `UPDATE entries SET updated_at = ${NOW_JST} WHERE id = ?`,
    ).run(entryId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
