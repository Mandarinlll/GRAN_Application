// notifications テーブル（アプリ内通知）へのアクセスを集約するリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6）。
import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type {
  InboxKind,
  InboxNotification,
} from "@/features/notifications/types/notification";

interface NotificationRow {
  id: string;
  kind: InboxKind;
  tournament_id: string | null;
  entry_id: string | null;
  title: string;
  body: string;
  is_read: number;
  is_resolved: number;
  created_at: string;
}

function toNotification(row: NotificationRow): InboxNotification {
  return {
    id: row.id,
    kind: row.kind,
    tournamentId: row.tournament_id,
    entryId: row.entry_id,
    title: row.title,
    body: row.body,
    isRead: row.is_read === 1,
    isResolved: row.is_resolved === 1,
    createdAt: row.created_at,
  };
}

// ---- 参照系 ----

export function listNotifications(userId: string): InboxNotification[] {
  const rows = db
    .prepare(
      "SELECT * FROM inbox_notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC",
    )
    .all(userId) as unknown as NotificationRow[];
  return rows.map(toNotification);
}

// 未読件数（バッジ用）。
export function countUnread(userId: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM inbox_notifications WHERE user_id = ? AND is_read = 0",
    )
    .get(userId) as { c: number };
  return row.c;
}

// ---- 更新系 ----

export interface CreateNotificationParams {
  userId: string;
  kind: InboxKind;
  tournamentId: string | null;
  entryId: string | null;
  title: string;
  body: string;
  dedupeKey: string;
  // 省略時は現在時刻（JST）。リマインドは発火予定時刻を渡す。
  createdAt?: string;
}

// 通知を作成する。dedupe_key が既にあれば何もしない（冪等）。
// 新規作成したら true。
export function createNotificationIfAbsent(
  params: CreateNotificationParams,
): boolean {
  const result = db
    .prepare(
      `INSERT INTO inbox_notifications (
        id, user_id, kind, tournament_id, entry_id, title, body, dedupe_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, ${NOW_JST}))
      ON CONFLICT(dedupe_key) DO NOTHING`,
    )
    .run(
      randomUUID(),
      params.userId,
      params.kind,
      params.tournamentId,
      params.entryId,
      params.title,
      params.body,
      params.dedupeKey,
      params.createdAt ?? null,
    );
  return Number(result.changes) > 0;
}

// 対応済みだった通知を再び要対応に戻す（未定枠が再発生した場合）。
export function reopenNotification(dedupeKey: string): void {
  db.prepare(
    "UPDATE inbox_notifications SET is_resolved = 0, is_read = 0 WHERE dedupe_key = ? AND is_resolved = 1",
  ).run(dedupeKey);
}

// 対応済みにする（既読も同時に付ける）。
export function resolveNotification(dedupeKey: string): void {
  db.prepare(
    "UPDATE inbox_notifications SET is_resolved = 1, is_read = 1 WHERE dedupe_key = ? AND is_resolved = 0",
  ).run(dedupeKey);
}

// 本人の通知のみ既読にする（他人の通知 ID を指定されても更新しない）。
export function markRead(userId: string, notificationId: string): void {
  db.prepare(
    "UPDATE inbox_notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
  ).run(notificationId, userId);
}

export function markAllRead(userId: string): void {
  db.prepare(
    "UPDATE inbox_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
  ).run(userId);
}

// ---- 通知生成の元データ取得 ----

export interface UpcomingEntryRow {
  entryId: string;
  tournamentId: string;
  tournamentTitle: string;
  eventDate: string;
  startTime: string;
  venue: string;
  ownerUserId: string;
  // 登録済みユーザーのメンバー（REGISTERED）の user_id。
  registeredMemberIds: string[];
  // 未定枠（PENDING）の数。
  pendingCount: number;
}

// 開催日が fromDate 以降の確定エントリー（CONFIRMED）を、メンバー情報つきで返す。
export function listUpcomingConfirmedEntries(
  fromDate: string,
  toDate: string,
): UpcomingEntryRow[] {
  const entries = db
    .prepare(
      `SELECT e.id AS entry_id, e.user_id AS owner_id, t.id AS t_id,
              t.title AS t_title, t.event_date AS t_date,
              t.start_time AS t_start, t.venue AS t_venue
         FROM entries e
         JOIN tournaments t ON t.id = e.tournament_id
        WHERE e.status = 'CONFIRMED'
          AND t.event_date >= ? AND t.event_date <= ?
          AND t.status != 'CANCELLED'`,
    )
    .all(fromDate, toDate) as Array<{
    entry_id: string;
    owner_id: string;
    t_id: string;
    t_title: string;
    t_date: string;
    t_start: string;
    t_venue: string;
  }>;
  const memberStmt = db.prepare(
    "SELECT member_type, user_id FROM entry_members WHERE entry_id = ?",
  );
  return entries.map((e) => {
    const members = memberStmt.all(e.entry_id) as Array<{
      member_type: string;
      user_id: string | null;
    }>;
    return {
      entryId: e.entry_id,
      tournamentId: e.t_id,
      tournamentTitle: e.t_title,
      eventDate: e.t_date,
      startTime: e.t_start,
      venue: e.t_venue,
      ownerUserId: e.owner_id,
      registeredMemberIds: members
        .filter((m) => m.member_type === "REGISTERED" && m.user_id)
        .map((m) => m.user_id as string),
      pendingCount: members.filter((m) => m.member_type === "PENDING").length,
    };
  });
}

// 未定枠（MEMBER_ASSIGN）通知の対応状況を同期するための、
// 未解決の MEMBER_ASSIGN 通知と、対応するエントリーの未定枠数・状態を返す。
export function listOpenMemberAssignNotifications(
  userId: string,
): Array<{ dedupeKey: string; entryActive: boolean; pendingCount: number }> {
  const rows = db
    .prepare(
      `SELECT n.dedupe_key AS dedupe_key, e.status AS e_status,
              (SELECT COUNT(*) FROM entry_members m
                WHERE m.entry_id = n.entry_id AND m.member_type = 'PENDING') AS pending
         FROM inbox_notifications n
         LEFT JOIN entries e ON e.id = n.entry_id
        WHERE n.user_id = ? AND n.kind = 'MEMBER_ASSIGN' AND n.is_resolved = 0`,
    )
    .all(userId) as Array<{
    dedupe_key: string;
    e_status: string | null;
    pending: number;
  }>;
  return rows.map((r) => ({
    dedupeKey: r.dedupe_key,
    entryActive: r.e_status === "CONFIRMED",
    pendingCount: r.pending,
  }));
}
