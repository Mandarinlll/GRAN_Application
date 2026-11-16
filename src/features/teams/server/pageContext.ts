// チームページ共通のログイン文脈（AppShell 用ユーザー + 所属・申請状況）を解決する。
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { countUnread } from "@/features/notifications/server/inboxRepository";
import {
  findMembershipTeamId,
  listPendingTeamIdsOfUser,
} from "@/features/teams/server/teamPageRepository";
import type { ShellUser } from "@/components/layout/AppShell";

export interface TeamPageContext {
  userId: string;
  shellUser: ShellUser;
  myTeamId: string | null;
  pendingTeamIds: string[];
}

export async function getTeamPageContext(): Promise<TeamPageContext | null> {
  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) return null;

  return {
    userId: session.sub,
    shellUser: {
      realName: user.realName,
      nickname: user.nickname,
      granLevel: user.granLevel,
      avatarText: user.avatarText,
      teamName: user.teamName || null,
      unreadNotifications: countUnread(session.sub),
    },
    myTeamId: findMembershipTeamId(session.sub),
    pendingTeamIds: listPendingTeamIdsOfUser(session.sub),
  };
}
