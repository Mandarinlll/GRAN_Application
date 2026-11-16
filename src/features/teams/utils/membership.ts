// ログインユーザーとチームの関係から、表示するボタン状態を決める純粋関数。
import type { MembershipState } from "@/features/teams/components/MembershipButton";

export function membershipStateFor(params: {
  teamId: string;
  leaderUserId: string;
  userId: string;
  myTeamId: string | null;
  pendingTeamIds: string[];
}): MembershipState {
  const { teamId, leaderUserId, userId, myTeamId, pendingTeamIds } = params;
  if (leaderUserId === userId) return "leader";
  if (myTeamId === teamId) return "member";
  if (myTeamId) return "blocked";
  if (pendingTeamIds.includes(teamId)) return "pending";
  return "none";
}
