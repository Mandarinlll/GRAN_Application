// teamAdminRepository のユニットテスト（インメモリDB）。
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createUser, findUserById } from "@/features/auth/server/userRepository";
import { addTeamMember, createTeam } from "@/features/teams/server/teamRepository";
import { inviteUser } from "@/features/teams/server/teamPageRepository";
import { db } from "@/lib/db";
import {
  disbandTeam,
  getTeamDetail,
  listTeamRecipientIds,
  listTeams,
  removeMember,
} from "@/features/accounts/server/teamAdminRepository";

let seq = 0;
function user() {
  seq += 1;
  return createUser({
    email: `tar-${seq}@example.com`,
    passwordHash: "x",
    realName: `氏名${seq}`,
    kanaName: "シメイ",
    nickname: `tarnick${seq}`,
    gender: "MALE",
    birthDate: "1990-01-01",
    phoneNumber: null,
    declaredClass: "C",
    granLevel: 500,
  });
}

function setup() {
  const leader = user();
  db.prepare("UPDATE users SET role = 'LEADER' WHERE id = ?").run(leader.id);
  const team = createTeam({ name: `TAR${seq}`, leaderUserId: leader.id });
  addTeamMember(team.id, leader.id);
  const member = user();
  addTeamMember(team.id, member.id);
  return { leader, team, member };
}

function addEntry(teamId: string, userId: string, status: string, memberUserId?: string) {
  const tid = randomUUID();
  db.prepare(
    `INSERT INTO tournaments (id, title, category, tier, event_date, start_time, venue, capacity, entry_fee, status, entry_start_at, entry_end_at)
     VALUES (?, '大会', 'MEN_TEAM', 'C', '2030-01-01', '09:00', '会場', 8, 0, 'OPEN', '2029-01-01 00:00:00', '2029-12-01 00:00:00')`,
  ).run(tid);
  const eid = randomUUID();
  db.prepare(
    `INSERT INTO entries (id, tournament_id, user_id, team_id, category, status) VALUES (?, ?, ?, ?, 'MEN_TEAM', ?)`,
  ).run(eid, tid, userId, teamId, status);
  if (memberUserId) {
    db.prepare(
      `INSERT INTO entry_members (id, entry_id, member_type, user_id, order_no) VALUES (?, ?, 'REGISTERED', ?, 1)`,
    ).run(randomUUID(), eid, memberUserId);
  }
  return eid;
}

describe("listTeams / getTeamDetail", () => {
  it("検索・件数・詳細を返す", () => {
    const { leader, team, member } = setup();
    addEntry(team.id, leader.id, "CONFIRMED");
    addEntry(team.id, leader.id, "CANCELLED");
    const list = listTeams({ q: team.name, page: 1 });
    expect(list.total).toBe(1);
    expect(list.rows[0]).toMatchObject({ id: team.id, memberCount: 2, activeEntryCount: 1 });
    expect(listTeams({ q: "存在しない名前zzz", page: 1 }).total).toBe(0);

    const inv = inviteUser(team.id, leader.id, user().id);
    expect(inv.ok).toBe(true);
    const d = getTeamDetail(team.id)!;
    expect(d.members.map((m) => m.userId)).toEqual([leader.id, member.id]);
    expect(d.activeEntries).toHaveLength(1);
    expect(d.pendingInvitations).toHaveLength(1);
    expect(getTeamDetail("none")).toBeNull();
  });
});

describe("removeMember", () => {
  it("除名で招待を CANCELLED にし通知を対応済みにする", () => {
    const { leader, team, member } = setup();
    const outsider = user();
    const inv = inviteUser(team.id, leader.id, outsider.id);
    if (!inv.ok || !inv.invitationId) throw new Error("invite");
    // 招待中のユーザーを team_members に追加（別経路で所属した状態）
    addTeamMember(team.id, outsider.id);
    expect(removeMember(team.id, outsider.id).ok).toBe(true);
    const row = db.prepare("SELECT status, resolved_at FROM team_invitations WHERE id = ?").get(inv.invitationId) as {
      status: string;
      resolved_at: string | null;
    };
    expect(row.status).toBe("CANCELLED");
    expect(row.resolved_at).not.toBeNull();
    const n = db.prepare("SELECT is_resolved FROM inbox_notifications WHERE ref_id = ?").get(inv.invitationId) as {
      is_resolved: number;
    };
    expect(n.is_resolved).toBe(1);
    expect(removeMember(team.id, member.id).ok).toBe(true);
  });

  it("代表者・非所属・エントリー割当中は拒否し何も変更しない", () => {
    const { leader, team, member } = setup();
    expect(removeMember(team.id, leader.id)).toEqual({ ok: false, reason: "IS_LEADER" });
    expect(removeMember(team.id, user().id)).toEqual({ ok: false, reason: "NOT_MEMBER" });
    expect(removeMember("none", member.id)).toEqual({ ok: false, reason: "NOT_FOUND" });
    addEntry(team.id, leader.id, "WAITING", member.id);
    expect(removeMember(team.id, member.id)).toEqual({ ok: false, reason: "ASSIGNED_TO_ENTRY" });
    expect(getTeamDetail(team.id)!.members).toHaveLength(2);
  });

  it("キャンセル済みエントリーへの割当は除名を妨げない", () => {
    const { leader, team, member } = setup();
    addEntry(team.id, leader.id, "CANCELLED", member.id);
    expect(removeMember(team.id, member.id).ok).toBe(true);
  });
});

describe("disbandTeam", () => {
  it("有効エントリーがあれば拒否する", () => {
    const { leader, team } = setup();
    addEntry(team.id, leader.id, "CONFIRMED");
    expect(disbandTeam(team.id)).toEqual({ ok: false, reason: "ACTIVE_TEAM_ENTRY" });
    expect(getTeamDetail(team.id)).not.toBeNull();
  });

  it("解散でチームと過去エントリーを削除し、代表者を USER に戻す", () => {
    const { leader, team, member } = setup();
    addEntry(team.id, leader.id, "CANCELLED");
    expect(listTeamRecipientIds(team.id).sort()).toEqual([leader.id, member.id].sort());
    const r = disbandTeam(team.id);
    expect(r.ok).toBe(true);
    expect(getTeamDetail(team.id)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS c FROM entries WHERE team_id = ?").get(team.id)).toEqual({ c: 0 });
    expect(findUserById(leader.id)?.role).toBe("USER");
  });

  it("ADMIN の代表者の role は変更しない", () => {
    const { leader, team } = setup();
    db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(leader.id);
    expect(disbandTeam(team.id).ok).toBe(true);
    expect(findUserById(leader.id)?.role).toBe("ADMIN");
  });
});
