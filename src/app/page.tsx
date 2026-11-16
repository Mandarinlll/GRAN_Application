// トップページ（URL: / ）= ログイン後のホーム画面。
// App Router では「src/app/page.tsx」が自動的にトップページになる。
//
// このファイルはサーバーコンポーネント。ここでセッションを検証し、
// ログイン中ユーザーを DB から取得する。未ログインなら /login へ誘導する。
//
// サイドバー・ヘッダー・ボトムナビは大会日程ページと共通の AppShell に統一する
// （activeId="home"）。これにより全画面でナビ表記が揃う。

import { redirect } from "next/navigation";
import { AdminBanner } from "@/components/home/AdminBanner";
import { EntryCalendar } from "@/components/home/EntryCalendar";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { getSession } from "@/lib/session";
import { getUnreadCountSynced } from "@/features/notifications/server/inboxService";

import { getEntryViewer } from "@/features/entries/server/entryViewData";
import { listTournamentCards } from "@/features/tournaments/server/tournamentCards";
import { getMyEntriesAction } from "@/features/entries/server/actions";
export default async function HomePage() {
  // セッション検証。未ログインならログイン画面へ。
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // AppShell に渡す共通ユーザー情報へ変換する。
  const shellUser = {
    realName: currentUser.realName,
    nickname: currentUser.nickname,
    granLevel: currentUser.granLevel,
    avatarText: currentUser.avatarText,
    teamName: currentUser.teamName || null,
    unreadNotifications: getUnreadCountSynced((await getSession())!.sub),
  };

  // 個人・チームのエントリーを統合し、キャンセル済みは除いてカレンダーに渡す。
  const { personal, team } = await getMyEntriesAction();
  const entries = [...personal, ...team].filter(
    (e, i, all) =>
      e.kind !== "CANCELLED" && all.findIndex((x) => x.entryId === e.entryId) === i,
  );

  const viewer = await getEntryViewer();
  if (!viewer) redirect("/login");
  const tournaments = listTournamentCards(viewer);

  return (
    <AppShell activeId="home" user={shellUser}>
      {/* 管理者バナー（管理者/運営者のときだけ表示） */}
      <AdminBanner
        role={currentUser.role === "OPERATOR" ? "OPERATOR" : "ADMIN"}
        visible={currentUser.isAdminPreview}
      />

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        <EntryCalendar entries={entries} tournaments={tournaments} viewer={viewer} />
      </main>
    </AppShell>
  );
}
