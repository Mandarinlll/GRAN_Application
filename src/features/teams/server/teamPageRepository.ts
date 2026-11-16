// チームページ（一覧・詳細・参加リクエスト・脱退）用のリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6）。
// 既存の teamRepository.ts（エントリー用）は変更せず、ページ専用クエリをここに置く。

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { granLevelToTier } from "@/features/auth/utils/classLabel";
import type {
  JoinRequestView,
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
      `SELECT t.id, t.name, t.leader_user_id, lu.nickname AS leader_nickname,
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
    leader_nickname: string;
    member_count: number;
    avg_level: number | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    leaderUserId: r.leader_user_id,
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
      `SELECT t.id, t.name, t.leader_user_id, t.created_at, lu.nickname AS leader_nickname
         FROM teams t JOIN users lu ON lu.id = t.leader_user_id
        WHERE t.id = ?`,
    )
    .get(teamId) as
    | {
        id: string;
        name: string;
        leader_user_id: string;
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

// ユーザーが所属するチームID（1ユーザー1チーム運用）。無ければ null。
export function findMembershipTeamId(userId: string): string | null {
  // 代表者は team_members に無い場合があるため、teams.leader_user_id も所属として扱う。
  const row = db
    .prepare(
      `SELECT team_id FROM (
         SELECT team_id, joined_at FROM team_members WHERE user_id = ?
         UNION ALL
         SELECT id AS team_id, created_at AS joined_at FROM teams WHERE leader_user_id = ?
       ) ORDER BY joined_at ASC LIMIT 1`,
    )
    .get(userId, userId) as { team_id: string } | undefined;
  return row?.team_id ?? null;
}

// ユーザーの承認待ちリクエスト先チームID一覧。
export function listPendingTeamIdsOfUser(userId: string): string[] {
  const rows = db
    .prepare("SELECT team_id FROM team_join_requests WHERE user_id = ? AND status = 'PENDING'")
    .all(userId) as Array<{ team_id: string }>;
  return rows.map((r) => r.team_id);
}

// チーム宛の承認待ちリクエスト（代表者向け）。
export function listPendingRequests(teamId: string): JoinRequestView[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.user_id, r.created_at, u.nickname, u.gran_level
         FROM team_join_requests r JOIN users u ON u.id = r.user_id
        WHERE r.team_id = ? AND r.status = 'PENDING'
        ORDER BY r.created_at ASC`,
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

export type JoinResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_MEMBER" | "ALREADY_PENDING" | "FORBIDDEN" | "NOT_PENDING" | "IS_LEADER" };

// 参加リクエスト送信。既にいずれかのチームに所属 / 同チームに申請中なら拒否。
export function createJoinRequest(teamId: string, userId: string): JoinResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const exists = db.prepare("SELECT 1 FROM teams WHERE id = ?").get(teamId);
    if (!exists) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (findMembershipTeamId(userId)) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "ALREADY_MEMBER" };
    }
    const pending = db
      .prepare(
        "SELECT 1 FROM team_join_requests WHERE team_id = ? AND user_id = ? AND status = 'PENDING'",
      )
      .get(teamId, userId);
    if (pending) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "ALREADY_PENDING" };
    }
    db.prepare(
      "INSERT INTO team_join_requests (id, team_id, user_id) VALUES (?, ?, ?)",
    ).run(randomUUID(), teamId, userId);
    db.exec("COMMIT");
    return { ok: true };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// 本人による取り下げ。
export function cancelJoinRequest(teamId: string, userId: string): JoinResult {
  const res = db
    .prepare(
      `UPDATE team_join_requests
          SET status = 'CANCELLED', resolved_at = datetime('now', '+9 hours')
        WHERE team_id = ? AND user_id = ? AND status = 'PENDING'`,
    )
    .run(teamId, userId);
  return Number(res.changes) > 0 ? { ok: true } : { ok: false, reason: "NOT_PENDING" };
}

// 代表者による承認/却下。承認時は team_members へ追加する（同一トランザクション）。
export function resolveJoinRequest(
  requestId: string,
  leaderUserId: string,
  approve: boolean,
): JoinResult {
  db.exec("BEGIN IMMEDIATE");
  try {
    const req = db
      .prepare(
        `SELECT r.id, r.team_id, r.user_id, r.status, t.leader_user_id
           FROM team_join_requests r JOIN teams t ON t.id = r.team_id
          WHERE r.id = ?`,
      )
      .get(requestId) as
      | { id: string; team_id: string; user_id: string; status: string; leader_user_id: string }
      | undefined;
    if (!req) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (req.leader_user_id !== leaderUserId) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "FORBIDDEN" };
    }
    if (req.status !== "PENDING") {
      db.exec("ROLLBACK");
      return { ok: false, reason: "NOT_PENDING" };
    }

    // 承認時、申請者が他チームへ参加済みなら却下扱いにして拒否する。
    if (approve && findMembershipTeamId(req.user_id)) {
      db.prepare(
        `UPDATE team_join_requests SET status = 'REJECTED', resolved_at = datetime('now', '+9 hours') WHERE id = ?`,
      ).run(requestId);
      db.exec("COMMIT");
      return { ok: false, reason: "ALREADY_MEMBER" };
    }

    db.prepare(
      `UPDATE team_join_requests SET status = ?, resolved_at = datetime('now', '+9 hours') WHERE id = ?`,
    ).run(approve ? "APPROVED" : "REJECTED", requestId);
    if (approve) {
      db.prepare(
        `INSERT INTO team_members (id, team_id, user_id) VALUES (?, ?, ?)`,
      ).run(randomUUID(), req.team_id, req.user_id);
      // 同ユーザーの他チーム宛の承認待ちは意味を失うため取り下げ扱いにする。
      db.prepare(
        `UPDATE team_join_requests
            SET status = 'CANCELLED', resolved_at = datetime('now', '+9 hours')
          WHERE user_id = ? AND status = 'PENDING'`,
      ).run(req.user_id);
    }
    db.exec("COMMIT");
    return { ok: true };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

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
