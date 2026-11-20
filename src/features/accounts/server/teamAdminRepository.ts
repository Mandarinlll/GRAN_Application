// 管理者用のチーム SELECT / 除名 / 解散。SQL はすべてバインド変数。
// トランザクション境界・認可・ログ・通知はサービス層が持つ（この層は BEGIN/COMMIT しない）。

import { db, NOW_JST } from "@/lib/db";
import { purgeTeamRows } from "@/features/teams/server/teamPageRepository";
import type {
  TeamActiveEntryRow,
  TeamDetail,
  TeamListRow,
  TeamMemberRow,
  TeamPendingInvitationRow,
} from "@/features/accounts/types/account";
import { PAGE_SIZE, type TeamListQuery } from "@/features/accounts/utils/listQuery";

// Active_Team_Entry の対象ステータス。
const ACTIVE_ENTRY_STATUSES = `('CONFIRMED','WAITING')`;

// 所属メンバー数（代表者を含む重複なしの人数）を求める副問い合わせ。
const MEMBER_COUNT_SQL = `(SELECT COUNT(*) FROM (
    SELECT user_id FROM team_members WHERE team_id = t.id
    UNION
    SELECT t.leader_user_id
  ))`;

const ACTIVE_ENTRY_COUNT_SQL = `(SELECT COUNT(*) FROM entries e
    WHERE e.team_id = t.id AND e.status IN ${ACTIVE_ENTRY_STATUSES})`;

// --- 一覧 ---

export function listTeams(query: TeamListQuery): { rows: TeamListRow[]; total: number; page: number } {
  const where: string[] = [];
  const params: string[] = [];
  if (query.q) {
    const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      `(t.name LIKE ? ESCAPE '\\' OR lu.real_name LIKE ? ESCAPE '\\' OR lu.nickname LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = `FROM teams t JOIN users lu ON lu.id = t.leader_user_id ${whereSql}`;

  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS c ${from}`).get(...params) as { c: number }).c,
  );
  // 範囲外のページは最終ページに丸める。
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(query.page)), pages);

  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.leader_user_id, lu.real_name AS leader_real_name,
              lu.nickname AS leader_nickname, t.created_at,
              ${MEMBER_COUNT_SQL} AS member_count,
              ${ACTIVE_ENTRY_COUNT_SQL} AS active_entry_count
         ${from}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as Array<{
    id: string;
    name: string;
    leader_user_id: string;
    leader_real_name: string;
    leader_nickname: string;
    created_at: string;
    member_count: number;
    active_entry_count: number;
  }>;

  return {
    total,
    page,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      leaderUserId: r.leader_user_id,
      leaderRealName: r.leader_real_name,
      leaderNickname: r.leader_nickname,
      memberCount: Number(r.member_count),
      activeEntryCount: Number(r.active_entry_count),
      createdAt: r.created_at,
    })),
  };
}

// --- 詳細 ---

export function getTeamDetail(teamId: string): TeamDetail | null {
  const team = db
    .prepare(
      `SELECT t.id, t.name, t.avatar_url, t.leader_user_id, t.created_at,
              lu.real_name AS leader_real_name, lu.nickname AS leader_nickname
         FROM teams t JOIN users lu ON lu.id = t.leader_user_id
        WHERE t.id = ?`,
    )
    .get(teamId) as
    | {
        id: string;
        name: string;
        avatar_url: string | null;
        leader_user_id: string;
        created_at: string;
        leader_real_name: string;
        leader_nickname: string;
      }
    | undefined;
  if (!team) return null;

  // team_members ∪ 代表者（代表者に team_members 行が無い場合も含める）。
  const memberRows = db
    .prepare(
      `SELECT u.id AS user_id, u.login_id, u.real_name, u.nickname, u.gran_level,
              tm.joined_at AS joined_at
         FROM users u
         LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
        WHERE tm.id IS NOT NULL OR u.id = ?
        ORDER BY (u.id = ?) DESC, tm.joined_at ASC, u.login_id ASC`,
    )
    .all(teamId, team.leader_user_id, team.leader_user_id) as Array<{
    user_id: string;
    login_id: string;
    real_name: string;
    nickname: string;
    gran_level: number;
    joined_at: string | null;
  }>;
  const members: TeamMemberRow[] = memberRows.map((m) => ({
    userId: m.user_id,
    loginId: m.login_id,
    realName: m.real_name,
    nickname: m.nickname,
    granLevel: m.gran_level,
    isLeader: m.user_id === team.leader_user_id,
    joinedAt: m.joined_at,
  }));

  const entryRows = db
    .prepare(
      `SELECT e.id AS entry_id, e.status, tn.id AS tournament_id, tn.title, tn.event_date
         FROM entries e JOIN tournaments tn ON tn.id = e.tournament_id
        WHERE e.team_id = ? AND e.status IN ${ACTIVE_ENTRY_STATUSES}
        ORDER BY tn.event_date ASC, e.id ASC`,
    )
    .all(teamId) as Array<{
    entry_id: string;
    status: "CONFIRMED" | "WAITING";
    tournament_id: string;
    title: string;
    event_date: string;
  }>;
  const activeEntries: TeamActiveEntryRow[] = entryRows.map((e) => ({
    entryId: e.entry_id,
    tournamentId: e.tournament_id,
    tournamentName: e.title,
    eventDate: e.event_date,
    status: e.status,
  }));

  const invRows = db
    .prepare(
      `SELECT i.id, i.created_at, u.nickname
         FROM team_invitations i JOIN users u ON u.id = i.user_id
        WHERE i.team_id = ? AND i.status = 'PENDING'
        ORDER BY i.created_at ASC, i.id ASC`,
    )
    .all(teamId) as Array<{ id: string; created_at: string; nickname: string }>;
  const pendingInvitations: TeamPendingInvitationRow[] = invRows.map((i) => ({
    id: i.id,
    inviteeNickname: i.nickname,
    createdAt: i.created_at,
  }));

  return {
    id: team.id,
    name: team.name,
    avatarKey: team.avatar_url,
    leaderUserId: team.leader_user_id,
    leaderRealName: team.leader_real_name,
    leaderNickname: team.leader_nickname,
    createdAt: team.created_at,
    members,
    activeEntries,
    pendingInvitations,
  };
}

// --- 判定クエリ ---

export function findTeamBasics(
  teamId: string,
): { id: string; name: string; leaderUserId: string; avatarKey: string | null } | null {
  const row = db
    .prepare("SELECT id, name, leader_user_id, avatar_url FROM teams WHERE id = ?")
    .get(teamId) as
    | { id: string; name: string; leader_user_id: string; avatar_url: string | null }
    | undefined;
  return row
    ? { id: row.id, name: row.name, leaderUserId: row.leader_user_id, avatarKey: row.avatar_url }
    : null;
}

// チームに Active_Team_Entry（CONFIRMED / WAITING）が 1 件以上あるか。
export function hasActiveTeamEntry(teamId: string): boolean {
  return (
    db
      .prepare(
        `SELECT 1 FROM entries WHERE team_id = ? AND status IN ${ACTIVE_ENTRY_STATUSES} LIMIT 1`,
      )
      .get(teamId) !== undefined
  );
}

// ユーザーが、そのチームの Active_Team_Entry の entry_members に REGISTERED として割り当てられているか。
export function isAssignedToActiveTeamEntry(teamId: string, userId: string): boolean {
  return (
    db
      .prepare(
        `SELECT 1
           FROM entry_members em JOIN entries e ON e.id = em.entry_id
          WHERE e.team_id = ? AND e.status IN ${ACTIVE_ENTRY_STATUSES}
            AND em.member_type = 'REGISTERED' AND em.user_id = ?
          LIMIT 1`,
      )
      .get(teamId, userId) !== undefined
  );
}

export function isTeamMemberRecord(teamId: string, userId: string): boolean {
  return (
    db.prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?").get(teamId, userId) !==
    undefined
  );
}

// 解散時の通知宛先（team_members ∪ 代表者、重複なし）。
export function listTeamRecipientIds(teamId: string): string[] {
  const rows = db
    .prepare(
      `SELECT user_id FROM team_members WHERE team_id = ?
       UNION
       SELECT leader_user_id AS user_id FROM teams WHERE id = ?`,
    )
    .all(teamId, teamId) as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

// --- 除名 ---

export type RemoveMemberResult =
  | { ok: true; teamName: string }
  | { ok: false; reason: "NOT_FOUND" | "IS_LEADER" | "NOT_MEMBER" | "ASSIGNED_TO_ENTRY" };

// 除名の書き込み（トランザクション制御なし）。前提条件を検証し、満たさなければ何も変更しない。
// 変更: team_members の削除、当該ユーザー宛て PENDING 招待の CANCELLED 化、対応する TEAM_INVITE 通知の対応済み化。
export function removeMember(teamId: string, userId: string): RemoveMemberResult {
  const team = findTeamBasics(teamId);
  if (!team) return { ok: false, reason: "NOT_FOUND" };
  if (team.leaderUserId === userId) return { ok: false, reason: "IS_LEADER" };
  if (!isTeamMemberRecord(teamId, userId)) return { ok: false, reason: "NOT_MEMBER" };
  if (isAssignedToActiveTeamEntry(teamId, userId)) {
    return { ok: false, reason: "ASSIGNED_TO_ENTRY" };
  }

  db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(teamId, userId);

  // 保留中の招待を CANCELLED にし、対応する未対応の TEAM_INVITE 通知を対応済みにする。
  const pending = db
    .prepare(
      "SELECT id FROM team_invitations WHERE team_id = ? AND user_id = ? AND status = 'PENDING'",
    )
    .all(teamId, userId) as Array<{ id: string }>;
  for (const inv of pending) {
    db.prepare(
      `UPDATE team_invitations SET status = 'CANCELLED', resolved_at = ${NOW_JST} WHERE id = ?`,
    ).run(inv.id);
    db.prepare(
      `UPDATE inbox_notifications SET is_resolved = 1, is_read = 1
        WHERE kind = 'TEAM_INVITE' AND ref_id = ? AND is_resolved = 0`,
    ).run(inv.id);
  }
  return { ok: true, teamName: team.name };
}

// --- 解散 ---

export type DisbandResult =
  | { ok: true; teamName: string; avatarKey: string | null; leaderUserId: string }
  | { ok: false; reason: "NOT_FOUND" | "ACTIVE_TEAM_ENTRY" };

// 解散の書き込み（トランザクション制御なし）。有効なチームエントリーがあれば何も変更しない。
// 通知の宛先取得・登録は、この関数の前にサービスが行う（チームの行が消えるため）。
export function disbandTeam(teamId: string): DisbandResult {
  const team = findTeamBasics(teamId);
  if (!team) return { ok: false, reason: "NOT_FOUND" };
  if (hasActiveTeamEntry(teamId)) return { ok: false, reason: "ACTIVE_TEAM_ENTRY" };

  purgeTeamRows(teamId);

  // 元の代表者が LEADER で、他に代表を務めるチームが無い場合のみ USER に戻す（ADMIN / OPERATOR は変更しない）。
  db.prepare(
    `UPDATE users SET role = 'USER', updated_at = ${NOW_JST}
      WHERE id = ? AND role = 'LEADER'
        AND NOT EXISTS (SELECT 1 FROM teams WHERE leader_user_id = users.id)`,
  ).run(team.leaderUserId);

  return {
    ok: true,
    teamName: team.name,
    avatarKey: team.avatarKey,
    leaderUserId: team.leaderUserId,
  };
}
