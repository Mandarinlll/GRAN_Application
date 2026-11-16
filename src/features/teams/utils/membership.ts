// ログインユーザーとチームの関係から、表示する状態を決める純粋関数。
import type { MembershipState } from "@/features/teams/components/MembershipButton";

export function membershipStateFor(params: {
  teamId: string;
  leaderUserId: string;
  userId: string;
  myTeamIds: string[];
}): MembershipState {
  const { teamId, leaderUserId, userId, myTeamIds } = params;
  if (leaderUserId === userId) return "leader";
  if (myTeamIds.includes(teamId)) return "member";
  return "none";
}