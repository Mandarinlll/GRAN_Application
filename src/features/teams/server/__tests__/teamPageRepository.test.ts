// チーム参加リクエスト・脱退・一覧集計のユニットテスト（インメモリDB）。
import { describe, it, expect } from "vitest";
import { createUser } from "@/features/auth/server/userRepository";
import { addTeamMember, createTeam } from "@/features/teams/server/teamRepository";
import {
  cancelJoinRequest,
  createJoinRequest,
  findMembershipTeamId,
  getTeamDetail,
  leaveTeam,
  listPendingRequests,
  listTeams,
  resolveJoinRequest,
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

describe("参加リクエスト", () => {
  it("送信→承認でメンバーに追加され、他の申請中は取り下げ扱いになる", () => {
    const a = setup();
    const b = setup();
    const u = user();
    expect(createJoinRequest(a.team.id, u.id).ok).toBe(true);
    expect(createJoinRequest(b.team.id, u.id).ok).toBe(true);
    const [req] = listPendingRequests(a.team.id);

    expect(resolveJoinRequest(req.id, a.leader.id, true).ok).toBe(true);
    expect(findMembershipTeamId(u.id)).toBe(a.team.id);
    expect(listPendingRequests(b.team.id)).toHaveLength(0);
  });

  it("同一チームへの二重申請と、所属済みユーザーの申請は拒否される", () => {
    const a = setup();
    const u = user();
    createJoinRequest(a.team.id, u.id);
    expect(createJoinRequest(a.team.id, u.id)).toEqual({ ok: false, reason: "ALREADY_PENDING" });
    expect(createJoinRequest(setup().team.id, a.leader.id)).toEqual({
      ok: false,
      reason: "ALREADY_MEMBER",
    });
  });

  it("代表者以外は承認できない", () => {
    const a = setup();
    const u = user();
    createJoinRequest(a.team.id, u.id);
    const [req] = listPendingRequests(a.team.id);
    expect(resolveJoinRequest(req.id, u.id, true)).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(findMembershipTeamId(u.id)).toBeNull();
  });

  it("却下・取り下げではメンバーに追加されない", () => {
    const a = setup();
    const u1 = user();
    const u2 = user();
    createJoinRequest(a.team.id, u1.id);
    createJoinRequest(a.team.id, u2.id);
    const reqs = listPendingRequests(a.team.id);
    resolveJoinRequest(reqs[0].id, a.leader.id, false);
    expect(cancelJoinRequest(a.team.id, u2.id).ok).toBe(true);
    expect(findMembershipTeamId(u1.id)).toBeNull();
    expect(findMembershipTeamId(u2.id)).toBeNull();
  });
});

describe("脱退", () => {
  it("メンバーは承認なしで脱退でき、代表者は脱退できない", () => {
    const a = setup();
    const u = user();
    createJoinRequest(a.team.id, u.id);
    resolveJoinRequest(listPendingRequests(a.team.id)[0].id, a.leader.id, true);

    expect(leaveTeam(a.team.id, u.id).ok).toBe(true);
    expect(findMembershipTeamId(u.id)).toBeNull();
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
