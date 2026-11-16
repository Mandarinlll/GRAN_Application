// チームページ（一覧・詳細・招待・脱退・除名・作成/編集/解散）用のリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6）。
// 既存の teamRepository.ts（エントリー用）は変更せず、ページ専用クエリをここに置く。

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { granLevelToTier } from "@/features/auth/utils/classLabel";
import type {
  InvitationView,
  InviteCandidate,
  TeamDetail,
  TeamListItem,
  TeamRecord,
  TeamResultRow,
} from "@/features/teams/types/team";
import type { TournamentCategory } from "@/features/tournaments/types/tournament";

// 階級は所属メンバーの平均GRANレベルから導出する（teams に階級列が無いため）。
function tierOf(avg: number | null) {
  return avg === null ? null : granLevelToTier(Math.round(avg));
}

// 種目は、キャンセルされていないエントリーの種目区分を重複排除して返す。
function categoriesOf(teamId: string): TournamentCategory[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT category FROM entries
        WHERE team_id = ? AND status != 'CANCELLED'
        ORDER BY category`,
    )
    .all(teamId) as Array<{ category: TournamentCategory }>;
  return rows.map((r) => r.category);
}

// チーム一覧。絞り込みはクライアント側で行うため全件返す。
export function listTeams(): TeamListItem[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.avatar_url, t.leader_user_id, lu.nickname AS leader_nickname,
              COUNT(tm.id) AS member_count, AVG(mu.gran_level) AS avg_level
         FROM teams t
         JOIN users lu ON lu.id = t.leader_user_id
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users mu ON mu.id = tm.user_id
        GROUP BY t.id
        ORDER BY t.name ASC`,
    )
    .all() as Array<{
    id: string;
    name: string;
    leader_user_id: string;
    avatar_url: string | null;
    leader_nickname: string;
    member_count: number;
    avg_level: number | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    leaderUserId: r.leader_user_id,
    avatarKey: r.avatar_url,
    leaderNickname: r.leader_nickname,
    memberCount: r.member_count,
    categories: categoriesOf(r.id),
    tier: tierOf(r.avg_level),
    averageGranLevel: r.avg_level === null ? null : Math.round(r.avg_level),
  }));
}

function recordOf(teamId: string): TeamRecord {
  const row = db
    .prepare(
      `SELECT
         COUNT(DISTINCT tournament_id) AS participations,
         COUNT(DISTINCT CASE WHEN rank_type = 'T1_WINNER' THEN tournament_id END) AS titles,
         COUNT(DISTINCT CASE WHEN rank_type = 'T1_RUNNER_UP' THEN tournament_id END) AS runner_ups,
         COUNT(DISTINCT CASE WHEN rank_type = 'L2_WINNER' THEN tournament_id END) AS l2_titles
       FROM tournament_results WHERE team_id = ?`,
    )
    .get(teamId) as {
    participations: number;
    titles: number;
    runner_ups: number;
    l2_titles: number;
  };
  return {
    participations: row.participations,
    titles: row.titles,
    runnerUps: row.runner_ups,
    l2Titles: row.l2_titles,
  };
}

// 大会ごとに1行（メンバー別に複数行あるため、大会単位で集約）。
function recentResultsOf(teamId: string): TeamResultRow[] {
  const rows = db
    .prepare(
      `SELECT tr.tournament_id, t.title, t.event_date,
              MAX(CASE tr.rank_type
                    WHEN 'T1_WINNER' THEN 4 WHEN 'T1_RUNNER_UP' THEN 3
                    WHEN 'L2_WINNER' THEN 2 ELSE 1 END) AS rank_order
         FROM tournament_results tr
         JOIN tournaments t ON t.id = tr.tournament_id
        WHERE tr.team_id = ?
        GROUP BY tr.tournament_id
        ORDER BY t.event_date DESC
        LIMIT 10`,
    )
    .all(teamId) as Array<{
    tournament_id: string;
    title: string;
    event_date: string;
    rank_order: number;
  }>;
  const byOrder: Record<number, TeamResultRow["rankType"]> = {
    4: "T1_WINNER",
    3: "T1_RUNNER_UP",
    2: "L2_WINNER",
    1: "PARTICIPATED",
  };
  return rows.map((r) => ({
    tournamentId: r.tournament_id,
    title: r.title,
    eventDate: r.event_date,
    rankType: byOrder[r.rank_order] ?? "PARTICIPATED",
  }));
}

export function getTeamDetail(teamId: string): TeamDetail | null {
  const team = db
    .prepare(
      `SELECT t.id, t.name, t.avatar_url, t.leader_user_id, t.created_at, lu.nickname AS leader_nickname
         FROM teams t JOIN users lu ON lu.id = t.leader_user_id
        WHERE t.id = ?`,
    )
    .get(teamId) as
    | {
        id: string;
        name: string;
        leader_user_id: string;
        avatar_url: string | null;
        created_at: string;
        leader_nickname: string;
      }
    | undefined;
  if (!team) return null;

  const memberRows = db
    .prepare(
      `SELECT u.id AS user_id, u.nickname, u.gran_level
         FROM team_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = ?
        ORDER BY tm.joined_at ASC`,
    )
    .all(teamId) as Array<{ user_id: string; nickname: string; gran_level: number }>;

  const avg = memberRows.length
    ? memberRows.reduce((s, m) => s + m.gran_level, 0) / memberRows.length
    : null;

  return {
    id: team.id,
    name: team.name,
    leaderUserId: team.leader_user_id,
    avatarKey: team.avatar_url,
    leaderNickname: team.leader_nickname,
    createdAt: team.created_at,
    categories: categoriesOf(teamId),
    tier: tierOf(avg),
    averageGranLevel: avg === null ? null : Math.round(avg),
    members: memberRows.map((m) => ({
      userId: m.user_id,
      nickname: m.nickname,
      granLevel: m.gran_level,
      isLeader: m.user_id === team.leader_user_id,
    })),
    record: recordOf(teamId),
    recentResults: recentResultsOf(teamId),
  };
}

// ユーザーが所属するチームID一覧（複数チーム所属可）。
// 代表者は team_members に無い場合があるため、teams.leader_user_id も所属として扱う。
export function listMembershipTeamIds(userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT team_id FROM team_members WHERE user_id = ?
       UNION
       SELECT id AS team_id FROM teams WHERE leader_user_id = ?`,
    )
    .all(userId, userId) as Array<{ team_id: string }>;
  return rows.map((r) => r.team_id);
}

function isMemberOf(teamId: string, userId: string): boolean {
  return listMembershipTeamIds(userId).includes(teamId);
}

// メンバー操作（脱退・除名）の結果。
export type JoinResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" | "IS_LEADER" | "NOT_MEMBER" };
// 脱退（承認不要）。代表者は脱退できない。
export function leaveTeam(teamId: string, userId: string): JoinResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const team = db
      .prepare("SELECT leader_user_id FROM teams WHERE id = ?")
      .get(teamId) as { leader_user_id: string } | undefined;
    if (!team) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (team.leader_user_id === userId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "IS_LEADER" };
    }
    const res = db
      .prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
      .run(teamId, userId);
    if (Number(res.changes) === 0) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    db.exec("COMMIT");
    return { ok: true };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// --- チームアイコン（avatar_url には画像ストレージの保存キーを持たせる） ---

export function getTeamAvatarKey(teamId: string): string | null {
  const row = db
    .prepare("SELECT avatar_url FROM teams WHERE id = ?")
    .get(teamId) as { avatar_url: string | null } | undefined;
  return row?.avatar_url ?? null;
}

export function isTeamLeaderOf(teamId: string, userId: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM teams WHERE id = ? AND leader_user_id = ?")
      .get(teamId, userId) !== undefined
  );
}

export function setTeamAvatarKey(teamId: string, key: string | null): void {
  db.prepare(
    "UPDATE teams SET avatar_url = ?, updated_at = datetime('now', '+9 hours') WHERE id = ?",
  ).run(key, teamId);
}

// --- チームの作成・編集・削除 ---

export type TeamMutationResult =
  | { ok: true; teamId: string }
  | { ok: false; reason: "ALREADY_LEADER" | "NAME_TAKEN" | "NOT_FOUND" | "FORBIDDEN" };

function nameTaken(name: string, exceptTeamId?: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM teams WHERE name = ? AND id <> ? LIMIT 1")
    .get(name, exceptTeamId ?? "");
  return row !== undefined;
}

// 代表者として新規チームを作成する。作成者を代表者かつメンバーにし、role を LEADER にする。
// （エントリー機能が users.role = 'LEADER' を代表者判定に使うため。ADMIN/OPERATOR は変更しない）
export function createTeamAsLeader(userId: string, name: string): TeamMutationResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT 1 FROM teams WHERE leader_user_id = ?").get(userId)) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "ALREADY_LEADER" };
    }
    if (nameTaken(name)) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NAME_TAKEN" };
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO teams (id, name, leader_user_id, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now', '+9 hours'), datetime('now', '+9 hours'))`,
    ).run(id, name, userId);
    db.prepare(
      `INSERT OR IGNORE INTO team_members (id, team_id, user_id) VALUES (?, ?, ?)`,
    ).run(randomUUID(), id, userId);
    db.prepare(
      `UPDATE users SET role = 'LEADER', updated_at = datetime('now', '+9 hours')
        WHERE id = ? AND role = 'USER'`,
    ).run(userId);
    db.exec("COMMIT");
    return { ok: true, teamId: id };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// チーム名の編集（代表者のみ）。
export function renameTeam(teamId: string, userId: string, name: string): TeamMutationResult {
  const team = db
    .prepare("SELECT leader_user_id FROM teams WHERE id = ?")
    .get(teamId) as { leader_user_id: string } | undefined;
  if (!team) return { ok: false, reason: "NOT_FOUND" };
  if (team.leader_user_id !== userId) return { ok: false, reason: "FORBIDDEN" };
  if (nameTaken(name, teamId)) return { ok: false, reason: "NAME_TAKEN" };
  db.prepare(
    "UPDATE teams SET name = ?, updated_at = datetime('now', '+9 hours') WHERE id = ?",
  ).run(name, teamId);
  return { ok: true, teamId };
}

// チーム解散（代表者のみ）。要件 4.1 に従い、過去エントリー・戦績も残さず削除する。
// 削除した画像のキーを返す（呼び出し側でストレージから削除する）。
export function deleteTeamAsLeader(
  teamId: string,
  userId: string,
): { ok: true; avatarKey: string | null } | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" } {
  db.exec("BEGIN IMMEDIATE");
  try {
    const team = db
      .prepare("SELECT leader_user_id, avatar_url FROM teams WHERE id = ?")
      .get(teamId) as { leader_user_id: string; avatar_url: string | null } | undefined;
    if (!team) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (team.leader_user_id !== userId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "FORBIDDEN" };
    }

    // 未対応のチーム招待通知は対応済みにする（招待自体は teams の CASCADE で消える）。
    db.prepare(
      `UPDATE inbox_notifications SET is_resolved = 1, is_read = 1
        WHERE kind = 'TEAM_INVITE' AND is_resolved = 0
          AND ref_id IN (SELECT id FROM team_invitations WHERE team_id = ?)`,
    ).run(teamId);

    // entries を参照する FK（ON DELETE なし）を先に外す。
    const entryIds = `SELECT id FROM entries WHERE team_id = ?`;
    db.prepare(`UPDATE tournament_matches SET entry1_id = NULL WHERE entry1_id IN (${entryIds})`).run(teamId);
    db.prepare(`UPDATE tournament_matches SET entry2_id = NULL WHERE entry2_id IN (${entryIds})`).run(teamId);
    db.prepare(`UPDATE tournament_matches SET winner_entry_id = NULL WHERE winner_entry_id IN (${entryIds})`).run(teamId);
    db.prepare(`UPDATE notification_logs SET entry_id = NULL WHERE entry_id IN (${entryIds})`).run(teamId);
    db.prepare("DELETE FROM entries WHERE team_id = ?").run(teamId); // entry_members / cancellations は CASCADE
    db.prepare("DELETE FROM waitlists WHERE team_id = ?").run(teamId);
    db.prepare("DELETE FROM tournament_results WHERE team_id = ?").run(teamId);
    db.prepare("DELETE FROM teams WHERE id = ?").run(teamId); // team_members / team_invitations は CASCADE

    // 他にチームを持たない代表者は role を USER に戻す（ADMIN/OPERATOR は変更しない）。
    db.prepare(
      `UPDATE users SET role = 'USER', updated_at = datetime('now', '+9 hours')
        WHERE id = ? AND role = 'LEADER'`,
    ).run(userId);
    db.exec("COMMIT");
    return { ok: true, avatarKey: team.avatar_url };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ユーザーが代表を務めるチームID（無ければ null）。
export function findLeaderTeamId(userId: string): string | null {
  const row = db
    .prepare("SELECT id FROM teams WHERE leader_user_id = ?")
    .get(userId) as { id: string } | undefined;
  return row?.id ?? null;
}

// 除名（代表者のみ）。代表者自身は除名できない。
// 除名後に別のユーザーを迎えたい場合は、招待→承諾で入れ替える。
export function removeMember(teamId: string, leaderUserId: string, targetUserId: string): JoinResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const team = db
      .prepare("SELECT leader_user_id FROM teams WHERE id = ?")
      .get(teamId) as { leader_user_id: string } | undefined;
    if (!team) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (team.leader_user_id !== leaderUserId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "FORBIDDEN" };
    }
    if (targetUserId === team.leader_user_id) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "IS_LEADER" };
    }
    const res = db
      .prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
      .run(teamId, targetUserId);
    if (Number(res.changes) === 0) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_MEMBER" };
    }
    db.exec("COMMIT");
    return { ok: true };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// --- チーム招待（代表者 → ユーザー。通知ページで承諾/辞退） ---

export type InviteResult =
  | { ok: true; invitationId?: string; teamId?: string }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "ALREADY_MEMBER"
        | "ALREADY_INVITED"
        | "NOT_PENDING"
        | "SELF";
    };

// 招待候補をニックネームの部分一致で検索する（代表者のみ）。
// すでに所属 / 招待中のユーザーは除く。
export function searchInviteCandidates(
  teamId: string,
  leaderUserId: string,
  query: string,
): InviteCandidate[] {
  if (!isTeamLeaderOf(teamId, leaderUserId)) return [];
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = db
    .prepare(
      `SELECT u.id, u.nickname, u.gran_level
         FROM users u
        WHERE u.nickname LIKE ? ESCAPE '\\'
          AND u.status = 'ACTIVE'
          AND u.id NOT IN (SELECT user_id FROM team_members WHERE team_id = ?)
          AND u.id NOT IN (SELECT leader_user_id FROM teams WHERE id = ?)
          AND u.id NOT IN (SELECT user_id FROM team_invitations WHERE team_id = ? AND status = 'PENDING')
        ORDER BY u.nickname ASC
        LIMIT 10`,
    )
    .all(`%${escaped}%`, teamId, teamId, teamId) as Array<{
    id: string;
    nickname: string;
    gran_level: number;
  }>;
  return rows.map((r) => ({ userId: r.id, nickname: r.nickname, granLevel: r.gran_level }));
}

// 招待を作成し、招待されたユーザーへ通知（inbox）を出す。
export function inviteUser(
  teamId: string,
  leaderUserId: string,
  targetUserId: string,
): InviteResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const team = db
      .prepare(
        `SELECT t.name, t.leader_user_id, lu.nickname AS leader_nickname
           FROM teams t JOIN users lu ON lu.id = t.leader_user_id WHERE t.id = ?`,
      )
      .get(teamId) as { name: string; leader_user_id: string; leader_nickname: string } | undefined;
    if (!team) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (team.leader_user_id !== leaderUserId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "FORBIDDEN" };
    }
    if (targetUserId === leaderUserId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "SELF" };
    }
    const target = db
      .prepare("SELECT 1 FROM users WHERE id = ? AND status = 'ACTIVE'")
      .get(targetUserId);
    if (!target) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (isMemberOf(teamId, targetUserId)) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "ALREADY_MEMBER" };
    }
    if (
      db
        .prepare("SELECT 1 FROM team_invitations WHERE team_id = ? AND user_id = ? AND status = 'PENDING'")
        .get(teamId, targetUserId)
    ) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "ALREADY_INVITED" };
    }

    const id = randomUUID();
    db.prepare("INSERT INTO team_invitations (id, team_id, user_id) VALUES (?, ?, ?)").run(
      id,
      teamId,
      targetUserId,
    );
    // 通知本体は、受信箱 inbox_notifications に TEAM_INVITE として登録する。
    db.prepare(
      `INSERT INTO inbox_notifications
         (id, user_id, kind, title, body, dedupe_key, ref_id)
       VALUES (?, ?, 'TEAM_INVITE', ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      targetUserId,
      "チームへの招待",
      `${team.leader_nickname} さんから「${team.name}」への招待が届いています。参加するか辞退するかを選んでください。`,
      `TEAM_INVITE:${id}`,
      id,
    );
    db.exec("COMMIT");
    return { ok: true, invitationId: id };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function resolveInviteNotification(invitationId: string): void {
  db.prepare(
    `UPDATE inbox_notifications SET is_resolved = 1, is_read = 1
      WHERE kind = 'TEAM_INVITE' AND ref_id = ? AND is_resolved = 0`,
  ).run(invitationId);
}

// 招待された本人による承諾/辞退。承諾でチームメンバーになる。
export function respondToInvitation(
  invitationId: string,
  userId: string,
  accept: boolean,
): InviteResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const inv = db
      .prepare("SELECT team_id, user_id, status FROM team_invitations WHERE id = ?")
      .get(invitationId) as { team_id: string; user_id: string; status: string } | undefined;
    if (!inv || inv.user_id !== userId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (inv.status !== "PENDING") {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_PENDING" };
    }
    db.prepare(
      `UPDATE team_invitations SET status = ?, resolved_at = datetime('now', '+9 hours') WHERE id = ?`,
    ).run(accept ? "ACCEPTED" : "DECLINED", invitationId);
    if (accept) {
      db.prepare(
        "INSERT OR IGNORE INTO team_members (id, team_id, user_id) VALUES (?, ?, ?)",
      ).run(randomUUID(), inv.team_id, userId);
    }
    resolveInviteNotification(invitationId);
    db.exec("COMMIT");
    return { ok: true, teamId: inv.team_id };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// 代表者による招待の取り消し。
export function cancelInvitation(invitationId: string, leaderUserId: string): InviteResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const inv = db
      .prepare(
        `SELECT i.status, t.leader_user_id FROM team_invitations i
           JOIN teams t ON t.id = i.team_id WHERE i.id = ?`,
      )
      .get(invitationId) as { status: string; leader_user_id: string } | undefined;
    if (!inv) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (inv.leader_user_id !== leaderUserId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "FORBIDDEN" };
    }
    if (inv.status !== "PENDING") {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_PENDING" };
    }
    db.prepare(
      `UPDATE team_invitations SET status = 'CANCELLED', resolved_at = datetime('now', '+9 hours') WHERE id = ?`,
    ).run(invitationId);
    resolveInviteNotification(invitationId);
    db.exec("COMMIT");
    return { ok: true };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// 招待中ユーザー一覧（代表者向け）。
export function listPendingInvitations(teamId: string): InvitationView[] {
  const rows = db
    .prepare(
      `SELECT i.id, i.user_id, i.created_at, u.nickname, u.gran_level
         FROM team_invitations i JOIN users u ON u.id = i.user_id
        WHERE i.team_id = ? AND i.status = 'PENDING'
        ORDER BY i.created_at ASC`,
    )
    .all(teamId) as Array<{
    id: string;
    user_id: string;
    created_at: string;
    nickname: string;
    gran_level: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    nickname: r.nickname,
    granLevel: r.gran_level,
    createdAt: r.created_at,
  }));
}