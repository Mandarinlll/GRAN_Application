// チームページ共通のログイン文脈（AppShell 用ユーザー + 所属チーム）を解決する。
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { countUnread } from "@/features/notifications/server/inboxRepository";
import { listMembershipTeamIds } from "@/features/teams/server/teamPageRepository";
import type { ShellUser } from "@/components/layout/AppShell";

export interface TeamPageContext {
  userId: string;
  shellUser: ShellUser;
  myTeamIds: string[];
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
    myTeamIds: listMembershipTeamIds(session.sub),
  };
}
