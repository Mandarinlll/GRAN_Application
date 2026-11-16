// チームの招待・脱退・除名・作成/編集/解散・一覧集計のユニットテスト（インメモリDB）。
import { describe, it, expect } from "vitest";
import { createUser } from "@/features/auth/server/userRepository";
import { addTeamMember, createTeam } from "@/features/teams/server/teamRepository";
import { findUserById } from "@/features/auth/server/userRepository";
import { db } from "@/lib/db";
import { findNotification, listNotifications } from "@/features/notifications/server/inboxRepository";
import {
  cancelInvitation,
  inviteUser,
  listPendingInvitations,
  respondToInvitation,
  searchInviteCandidates,
  createTeamAsLeader,
  deleteTeamAsLeader,
  renameTeam,
  listMembershipTeamIds,
  removeMember,
  getTeamDetail,
  leaveTeam,
  listTeams,
} from "@/features/teams/server/teamPageRepository";
import { filterTeams } from "@/features/teams/utils/filter";

let seq = 0;
function user(granLevel = 500) {
  seq += 1;
  return createUser({
    email: `team-test-${seq}@example.com`,
    passwordHash: "x",
    realName: `氏名${seq}`,
    kanaName: "シメイ",
    nickname: `nick${seq}`,
    gender: "MALE",
    birthDate: "1990-01-01",
    phoneNumber: null,
    declaredClass: "C",
    granLevel,
  });
}

function setup() {
  const leader = user(850);
  const team = createTeam({ name: `T${seq}`, leaderUserId: leader.id });
  addTeamMember(team.id, leader.id);
  return { leader, team };
}

// 招待→承諾でメンバーに加える（参加の唯一の経路）。
function join(teamId: string, leaderId: string, userId: string) {
  const r = inviteUser(teamId, leaderId, userId);
  if (!r.ok || !r.invitationId) throw new Error(`invite failed: ${JSON.stringify(r)}`);
  const res = respondToInvitation(r.invitationId, userId, true);
  if (!res.ok) throw new Error("accept failed");
}

describe("複数チームへの所属", () => {
  it("一般ユーザーも他チームの代表者も、招待経由で複数チームに所属できる", () => {
    const a = setup();
    const b = setup();
    const u = user();
    join(a.team.id, a.leader.id, u.id);
    join(b.team.id, b.leader.id, u.id);
    expect(listMembershipTeamIds(u.id).sort()).toEqual([a.team.id, b.team.id].sort());

    join(b.team.id, b.leader.id, a.leader.id);
    expect(listMembershipTeamIds(a.leader.id).sort()).toEqual([a.team.id, b.team.id].sort());
  });
});
describe("脱退", () => {
  it("メンバーは承認なしで脱退でき、代表者は脱退できない", () => {
    const a = setup();
    const u = user();
    join(a.team.id, a.leader.id, u.id);

    expect(leaveTeam(a.team.id, u.id).ok).toBe(true);
    expect(listMembershipTeamIds(u.id)).toEqual([]);
    expect(leaveTeam(a.team.id, a.leader.id)).toEqual({ ok: false, reason: "IS_LEADER" });
  });
});

describe("一覧・詳細", () => {
  it("平均GRANレベルから階級を導出し、階級で絞り込める", () => {
    const a = setup(); // 代表 850 → A
    const found = listTeams().find((t) => t.id === a.team.id);
    expect(found?.tier).toBe("A");
    expect(filterTeams(listTeams(), "ALL", "A").some((t) => t.id === a.team.id)).toBe(true);
    expect(filterTeams(listTeams(), "ALL", "DE").some((t) => t.id === a.team.id)).toBe(false);
  });

  it("詳細に代表者とメンバー・成績が含まれる", () => {
    const a = setup();
    const d = getTeamDetail(a.team.id);
    expect(d?.leaderNickname).toBe(a.leader.nickname);
    expect(d?.members).toHaveLength(1);
    expect(d?.record.participations).toBe(0);
    expect(getTeamDetail("none")).toBeNull();
  });
});

describe("チームの作成・編集・削除", () => {
  it("作成すると代表者かつメンバーになり、role が LEADER になる。二重作成・同名は拒否", () => {
    const u = user();
    const r = createTeamAsLeader(u.id, "新チーム" + u.id);
    expect(r.ok).toBe(true);
    expect(findUserById(u.id)?.role).toBe("LEADER");
    expect(listMembershipTeamIds(u.id)).toEqual([r.ok ? r.teamId : ""]);
    expect(createTeamAsLeader(u.id, "別名")).toEqual({ ok: false, reason: "ALREADY_LEADER" });

    const other = user();
    expect(createTeamAsLeader(other.id, "新チーム" + u.id)).toEqual({ ok: false, reason: "NAME_TAKEN" });
  });

  it("名称変更は代表者のみ。自チーム名への変更は許可、他チームと同名は拒否", () => {
    const a = setup();
    const b = setup();
    const stranger = user();
    expect(renameTeam(a.team.id, stranger.id, "x")).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(renameTeam(a.team.id, a.leader.id, a.team.name).ok).toBe(true);
    expect(renameTeam(a.team.id, a.leader.id, b.team.name)).toEqual({ ok: false, reason: "NAME_TAKEN" });
    expect(renameTeam(a.team.id, a.leader.id, "改名後" + a.team.id).ok).toBe(true);
    expect(getTeamDetail(a.team.id)?.name).toBe("改名後" + a.team.id);
  });

  it("解散は代表者のみ。メンバー・招待が消え、role が USER に戻る", () => {
    const a = createTeamAsLeader(user().id, "解散対象");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const leaderId = (db.prepare("SELECT leader_user_id AS id FROM teams WHERE id = ?").get(a.teamId) as { id: string }).id;
    const m = user();
    inviteUser(a.teamId, (db.prepare("SELECT leader_user_id AS id FROM teams WHERE id = ?").get(a.teamId) as { id: string }).id, m.id);

    expect(deleteTeamAsLeader(a.teamId, m.id)).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(deleteTeamAsLeader(a.teamId, leaderId).ok).toBe(true);
    expect(getTeamDetail(a.teamId)).toBeNull();
    expect(listMembershipTeamIds(leaderId)).toEqual([]);
    expect(findUserById(leaderId)?.role).toBe("USER");
    expect(listNotifications(m.id).find((x) => x.kind === "TEAM_INVITE")?.isResolved).toBe(true);
    expect(deleteTeamAsLeader(a.teamId, leaderId)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});
describe("メンバーの除名", () => {
  it("代表者だけが除名でき、代表者自身・非メンバーは除名できない。除名後は再招待できる", () => {
    const a = setup();
    const u = user();
    join(a.team.id, a.leader.id, u.id);

    expect(removeMember(a.team.id, u.id, u.id)).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(removeMember(a.team.id, a.leader.id, a.leader.id)).toEqual({ ok: false, reason: "IS_LEADER" });
    expect(removeMember(a.team.id, a.leader.id, user().id)).toEqual({ ok: false, reason: "NOT_MEMBER" });
    expect(removeMember(a.team.id, a.leader.id, u.id).ok).toBe(true);
    expect(listMembershipTeamIds(u.id)).toEqual([]);
    expect(inviteUser(a.team.id, a.leader.id, u.id).ok).toBe(true);
  });
});

describe("チーム招待", () => {
  it("招待すると相手の通知に TEAM_INVITE が届き、承諾でメンバーになる", () => {
    const a = setup();
    const u = user();
    const r = inviteUser(a.team.id, a.leader.id, u.id);
    expect(r.ok).toBe(true);

    const [n] = listNotifications(u.id).filter((x) => x.kind === "TEAM_INVITE");
    expect(n.isResolved).toBe(false);
    expect(n.refId).toBe(r.ok ? r.invitationId : null);

    expect(respondToInvitation(n.refId!, u.id, true)).toEqual({ ok: true, teamId: a.team.id });
    expect(listMembershipTeamIds(u.id)).toEqual([a.team.id]);
    expect(listNotifications(u.id).find((x) => x.id === n.id)?.isResolved).toBe(true);
    expect(respondToInvitation(n.refId!, u.id, true)).toEqual({ ok: false, reason: "NOT_PENDING" });
  });

  it("辞退ではメンバーにならない。他人は応答できない", () => {
    const a = setup();
    const u = user();
    const other = user();
    const r = inviteUser(a.team.id, a.leader.id, u.id);
    const id = r.ok ? r.invitationId! : "";
    expect(respondToInvitation(id, other.id, true)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(respondToInvitation(id, u.id, false).ok).toBe(true);
    expect(listMembershipTeamIds(u.id)).toEqual([]);
  });

  it("代表者以外・自分・所属済み・招待済みは招待できない", () => {
    const a = setup();
    const u = user();
    expect(inviteUser(a.team.id, u.id, user().id)).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(inviteUser(a.team.id, a.leader.id, a.leader.id)).toEqual({ ok: false, reason: "SELF" });
    inviteUser(a.team.id, a.leader.id, u.id);
    expect(inviteUser(a.team.id, a.leader.id, u.id)).toEqual({ ok: false, reason: "ALREADY_INVITED" });
    respondToInvitation(listPendingInvitations(a.team.id)[0]?.id ?? "", u.id, true);
    expect(inviteUser(a.team.id, a.leader.id, u.id)).toEqual({ ok: false, reason: "ALREADY_MEMBER" });
  });

  it("取り消すと招待が消え、通知は対応済みになる", () => {
    const a = setup();
    const u = user();
    inviteUser(a.team.id, a.leader.id, u.id);
    const [inv] = listPendingInvitations(a.team.id);
    expect(cancelInvitation(inv.id, u.id)).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(cancelInvitation(inv.id, a.leader.id).ok).toBe(true);
    expect(listPendingInvitations(a.team.id)).toHaveLength(0);
    expect(listNotifications(u.id).find((x) => x.kind === "TEAM_INVITE")?.isResolved).toBe(true);
  });

  it("検索はニックネームの部分一致で、所属・招待中を除き、代表者のみ実行できる", () => {
    const a = setup();
    const target = user();
    const keyword = target.nickname;
    expect(searchInviteCandidates(a.team.id, a.leader.id, keyword).map((c) => c.userId)).toContain(target.id);
    expect(searchInviteCandidates(a.team.id, target.id, keyword)).toEqual([]);
    expect(searchInviteCandidates(a.team.id, a.leader.id, "%")).toEqual([]);
    inviteUser(a.team.id, a.leader.id, target.id);
    expect(searchInviteCandidates(a.team.id, a.leader.id, keyword).map((c) => c.userId)).not.toContain(target.id);
  });
});

describe("通知詳細の取得", () => {
  it("本人の通知だけを取得でき、他人の通知IDでは null", () => {
    const a = setup();
    const u = user();
    inviteUser(a.team.id, a.leader.id, u.id);
    const [n] = listNotifications(u.id);
    expect(findNotification(u.id, n.id)?.id).toBe(n.id);
    expect(findNotification(a.leader.id, n.id)).toBeNull();
    expect(findNotification(u.id, "missing")).toBeNull();
  });
});