// TeamRepository の SQLite 実装（oop-architecture.md §2.4）。
// SQL はこの層にのみ閉じ込める（既存規約 §6）。
//
// 現行 teams/server/teamRepository.ts の SQL・行→Team 変換・メンバー結合を 1:1 で移植した。
// Team は不変条件を持たないためエンティティ化せず、DTO として返す。

import type { DatabaseSync } from "node:sqlite";
import type {
  Team,
  TeamMemberView,
  TeamWithMembers,
} from "@/features/teams/types/team";
import type { TeamRepository } from "@/features/teams/domain/TeamRepository";

interface TeamRow {
  id: string;
  name: string;
  avatar_url: string | null;
  leader_user_id: string;
  created_at: string;
  updated_at: string;
}

export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: DatabaseSync) {}

  private toTeam(row: TeamRow): Team {
    return {
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      leaderUserId: row.leader_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findByLeader(userId: string): Team | null {
    const row = this.db
      .prepare("SELECT * FROM teams WHERE leader_user_id = ? LIMIT 1")
      .get(userId) as TeamRow | undefined;
    return row ? this.toTeam(row) : null;
  }

  findById(teamId: string): Team | null {
    const row = this.db
      .prepare("SELECT * FROM teams WHERE id = ?")
      .get(teamId) as TeamRow | undefined;
    return row ? this.toTeam(row) : null;
  }

  findWithMembers(teamId: string): TeamWithMembers | null {
    const team = this.findById(teamId);
    if (!team) return null;

    // チームメンバーを users と結合して取得。代表者も members に含める。
    const rows = this.db
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

  isTeamMember(teamId: string, userId: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1",
      )
      .get(teamId, userId);
    return row !== undefined;
  }
}
