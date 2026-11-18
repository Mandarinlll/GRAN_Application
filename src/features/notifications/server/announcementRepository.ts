// 運営からのお知らせ・緊急連絡（admin_announcements）のリポジトリ。SQL はこの層にのみ閉じ込める。
//
// 送信は「受信者ごとに inbox_notifications を作成する」ことで行う（アプリ内通知）。
// 緊急連絡は notification_logs(URGENT_BROADCAST) にも配信ログを残す。
// メール・Webプッシュの実送信は行わない（logNotification のスタブ方針と同じ）。
import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import { logNotification } from "@/features/notifications/server/notificationRepository";
import type { CreateAnnouncementInput } from "@/features/notifications/types/announcementSchema";
import type {
  AdminAnnouncement,
  AnnouncementTournamentOption,
} from "@/features/notifications/types/announcement";

// 全ユーザー宛て: ACTIVE のアカウント。
function listAllRecipientIds(): string[] {
  const rows = db.prepare("SELECT id FROM users WHERE status = 'ACTIVE'").all() as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

// 大会宛て: 確定エントリーの申込者と、登録済みメンバー。停止中などのアカウントは除く。
function listTournamentRecipientIds(tournamentId: string): string[] {
  const rows = db
    .prepare(
      `SELECT u.id AS id FROM users u
        WHERE u.status = 'ACTIVE' AND u.id IN (
          SELECT e.user_id FROM entries e
           WHERE e.tournament_id = ? AND e.status = 'CONFIRMED'
          UNION
          SELECT m.user_id FROM entry_members m
            JOIN entries e ON e.id = m.entry_id
           WHERE e.tournament_id = ? AND e.status = 'CONFIRMED'
             AND m.member_type = 'REGISTERED' AND m.user_id IS NOT NULL
        )`,
    )
    .all(tournamentId, tournamentId) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function tournamentExists(tournamentId: string): boolean {
  return !!db.prepare("SELECT 1 FROM tournaments WHERE id = ?").get(tournamentId);
}

// 配信対象人数（送信前の確認表示用）。
export function countRecipients(audience: "ALL" | "TOURNAMENT", tournamentId?: string | null): number {
  return audience === "ALL" ? listAllRecipientIds().length : listTournamentRecipientIds(tournamentId ?? "").length;
}

// お知らせを作成し、受信者の受信箱へ配信する。全体を1トランザクションで行う。
export function createAnnouncement(
  input: CreateAnnouncementInput,
  createdBy: string,
): { id: string; recipientCount: number } {
  const tournamentId = input.audience === "TOURNAMENT" ? (input.tournamentId ?? null) : null;
  const recipients =
    input.audience === "ALL" ? listAllRecipientIds() : listTournamentRecipientIds(tournamentId ?? "");
  const id = randomUUID();
  const kind = input.isUrgent ? "URGENT" : "ANNOUNCEMENT";

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO admin_announcements
         (id, title, body, is_urgent, tournament_id, created_by, recipient_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW_JST})`,
    ).run(id, input.title, input.body, input.isUrgent ? 1 : 0, tournamentId, createdBy, recipients.length);

    const insert = db.prepare(
      `INSERT INTO inbox_notifications
         (id, user_id, kind, tournament_id, title, body, dedupe_key, is_resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ${NOW_JST})
       ON CONFLICT(dedupe_key) DO NOTHING`,
    );
    for (const userId of recipients) {
      insert.run(randomUUID(), userId, kind, tournamentId, input.title, input.body, `ANNOUNCE:${id}:${userId}`);
      if (input.isUrgent) {
        logNotification({
          deliveryType: "URGENT_BROADCAST",
          userId,
          tournamentId,
          messagePayload: `${input.title}\n${input.body}`,
        });
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { id, recipientCount: recipients.length };
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  is_urgent: number;
  tournament_id: string | null;
  tournament_title: string | null;
  recipient_count: number;
  login_id: string | null;
  created_at: string;
}

// 送信履歴（新しい順）。
export function listAnnouncements(limit = 100): AdminAnnouncement[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.is_urgent, a.tournament_id, t.title AS tournament_title,
              a.recipient_count, u.login_id AS login_id, a.created_at
         FROM admin_announcements a
         LEFT JOIN tournaments t ON t.id = a.tournament_id
         LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?`,
    )
    .all(limit) as unknown as AnnouncementRow[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    isUrgent: r.is_urgent === 1,
    tournamentId: r.tournament_id,
    tournamentTitle: r.tournament_title,
    recipientCount: r.recipient_count,
    createdByLoginId: r.login_id,
    createdAt: r.created_at,
  }));
}

// 宛先に選べる大会（中止を除く。開催日が新しい順）。
export function listTournamentOptions(): AnnouncementTournamentOption[] {
  const rows = db
    .prepare(
      `SELECT id, title, event_date, status FROM tournaments
        WHERE status != 'CANCELLED'
        ORDER BY event_date DESC, id DESC`,
    )
    .all() as Array<{ id: string; title: string; event_date: string; status: string }>;
  return rows.map((r) => ({ id: r.id, title: r.title, eventDate: r.event_date, status: r.status }));
}