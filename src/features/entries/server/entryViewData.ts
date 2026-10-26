// 大会日程ページ／エントリーUIで必要な「ログイン文脈」をまとめて解決する。
// Server Component から呼び出し、クライアントコンポーネントへ props で渡す。

import { getSession } from "@/lib/session";
import { findUserById } from "@/features/auth/server/userRepository";
import { findTeamWithMembers, findTeamByLeader } from "@/features/teams/server/teamRepository";
import type { TeamMemberView } from "@/features/teams/types/team";

// エントリー操作のためにクライアントが必要とするログインユーザー文脈。
export interface EntryViewer {
  userId: string;
  loginId: string;
  realName: string;
  nickname: string;
  email: string;
  granLevel: number;
  role: "ADMIN" | "OPERATOR" | "LEADER" | "USER";
  isAdmin: boolean;
  // 代表を務めるチーム（無ければ null）。団体戦・ダブルス申込に使う。
  team: {
    id: string;
    name: string;
    members: TeamMemberView[]; // 代表者含む所属メンバー（メンバー指定の候補）
  } | null;
}

// 現在のログインユーザーのエントリー文脈を解決する。未ログインなら null。
export async function getEntryViewer(): Promise<EntryViewer | null> {
  const session = await getSession();
  if (!session) return null;

  const user = findUserById(session.sub);
  if (!user) return null;

  // 代表を務めるチームがあれば、そのメンバー一覧も解決する。
  const leaderTeam = findTeamByLeader(user.id);
  let team: EntryViewer["team"] = null;
  if (leaderTeam) {
    const withMembers = findTeamWithMembers(leaderTeam.id);
    if (withMembers) {
      team = {
        id: withMembers.team.id,
        name: withMembers.team.name,
        members: withMembers.members,
      };
    }
  }

  return {
    userId: user.id,
    loginId: user.loginId,
    realName: user.realName,
    nickname: user.nickname,
    email: user.email,
    granLevel: user.granLevel,
    role: user.role,
    isAdmin: user.isAdmin,
    team,
  };
}
