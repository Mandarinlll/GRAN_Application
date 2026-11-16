// 設定ページ（URL: /settings）。
// ユーザー情報の確認・変更 / アプリ設定 / 利用ガイド・規約の確認を提供する。
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { findUserById } from "@/features/auth/server/userRepository";
import { getUnreadCountSynced } from "@/features/notifications/server/inboxService";
import { getSettings } from "@/features/settings/server/settingsRepository";
import { splitName } from "@/features/settings/utils/name";
import { SettingsView } from "@/features/settings/components/SettingsView";

export default async function SettingsPage() {
  const session = await getSession();
  const current = await getCurrentUser();
  if (!session || !current) redirect("/login");

  const user = findUserById(session.sub);
  if (!user) redirect("/login");

  const name = splitName(user.realName);
  const kana = splitName(user.kanaName);

  const shellUser = {
    realName: current.realName,
    nickname: current.nickname,
    granLevel: current.granLevel,
    avatarText: current.avatarText,
    teamName: current.teamName || null,
    unreadNotifications: getUnreadCountSynced(session.sub),
  };

  return (
    <AppShell activeId="settings" user={shellUser}>
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <PageHeader icon={Settings} title="設定" />
        <SettingsView
          profile={{
            loginId: user.loginId,
            lastName: name.last,
            firstName: name.first,
            lastKana: kana.last,
            firstKana: kana.first,
            nickname: user.nickname,
            phoneNumber: user.phoneNumber ?? "",
            email: user.email,
          }}
          settings={getSettings(session.sub)}
        />
      </main>
    </AppShell>
  );
}
