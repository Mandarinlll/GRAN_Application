// teams / team_members テーブルへのアクセスを集約するリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6）。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type { Team, TeamMemberView, TeamWithMembers } from "@/features/teams/types/team";

interface TeamRow {
  id: string;
  name: string;
  avatar_url: string | null;
  leader_user_id: string;
  created_at: string;
  updated_at: string;
}

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    leaderUserId: row.leader_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ユーザーが代表者（leader）を務めるチームを取得する。無ければ null。
// 「1ユーザー1代表」制約（teams.leader_user_id UNIQUE）により最大1件。
export function findTeamByLeader(userId: string): Team | null {
  const row = db
    .prepare("SELECT * FROM teams WHERE leader_user_id = ? LIMIT 1")
    .get(userId) as TeamRow | undefined;
  return row ? toTeam(row) : null;
}

// id からチームを1件取得する。
export function findTeamById(teamId: string): Team | null {
  const row = db
    .prepare("SELECT * FROM teams WHERE id = ?")
    .get(teamId) as TeamRow | undefined;
  return row ? toTeam(row) : null;
}

// チーム + 所属メンバー（表示情報付き）を取得する。
export function findTeamWithMembers(teamId: string): TeamWithMembers | null {
  const team = findTeamById(teamId);
  if (!team) return null;

  // チームメンバーを users と結合して取得。代表者も members に含める。
  const rows = db
    .prepare(
      `SELECT u.id AS user_id, u.real_name, u.nickname, u.gran_level
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = ?
        ORDER BY tm.joined_at ASC`,
    )
    .all(teamId) as Array<{
    user_id: string;
    real_name: string;
    nickname: string;
    gran_level: number;
  }>;

  const members: TeamMemberView[] = rows.map((r) => ({
    userId: r.user_id,
    realName: r.real_name,
    nickname: r.nickname,
    granLevel: r.gran_level,
    isLeader: r.user_id === team.leaderUserId,
  }));

  const leader = members.find((m) => m.isLeader);
  const leaderName = leader?.realName ?? "";

  return { team, leaderName, members };
}

// ユーザーがそのチームに所属しているか（メンバーテーブル基準）。
export function isTeamMember(teamId: string, userId: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1")
    .get(teamId, userId);
  return row !== undefined;
}

// --- シード・テスト用の作成系（本番のチーム作成機能は別スコープ） ---

// チームを作成する。既に代表を務めている場合は UNIQUE 制約で失敗する。
export function createTeam(params: {
  name: string;
  leaderUserId: string;
  avatarUrl?: string | null;
}): Team {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO teams (id, name, avatar_url, leader_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
  ).run(id, params.name, params.avatarUrl ?? null, params.leaderUserId);
  const row = db.prepare("SELECT * FROM teams WHERE id = ?").get(id) as TeamRow;
  return toTeam(row);
}

// メンバーを追加する（既に所属済みなら何もしない）。
export function addTeamMember(teamId: string, userId: string): void {
  const exists = isTeamMember(teamId, userId);
  if (exists) return;
  db.prepare(
    `INSERT INTO team_members (id, team_id, user_id, joined_at)
     VALUES (?, ?, ?, ${NOW_JST})`,
  ).run(randomUUID(), teamId, userId);
}
