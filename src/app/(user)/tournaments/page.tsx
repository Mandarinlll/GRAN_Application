// 大会日程・要項一覧ページ（URL: /tournaments）。
// サーバーコンポーネント。セッション検証 → 大会一覧と申込状況を取得し、
// クライアントコンポーネント（TournamentSchedule）へ表示用 DTO を渡す。
//
// 元モック: tests/schedule.html（データはベタ打ち）を、
// 実 DB（tournaments / entries / waitlists）に接続した本番実装へ置き換えたもの。

import { redirect } from "next/navigation";
import { listTournamentCards } from "@/features/tournaments/server/tournamentCards";
import { getMyEntriesAction } from "@/features/entries/server/actions";
import { countActiveTournaments } from "@/features/entries/utils/entryFilters";
import { getEntryViewer } from "@/features/entries/server/entryViewData";
import { TournamentSchedule } from "@/features/tournaments/components/TournamentSchedule";
import { getUnreadCountSynced } from "@/features/notifications/server/inboxService";

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ editEntry?: string }>;
}) {
  // 通知ページからの遷移時: 指定エントリーのメンバー変更モーダルを開く。
  const { editEntry } = await searchParams;
  // ログイン必須。
  const viewer = await getEntryViewer();
  if (!viewer) redirect("/login");

  const cards = listTournamentCards(viewer);

  // 個人戦・団体戦のエントリー済み大会数（KPIカード用）。
  const mine = await getMyEntriesAction();
  const entryCounts = {
    personal: countActiveTournaments(mine.personal),
    team: countActiveTournaments(mine.team),
  };

  return (
    <TournamentSchedule
      tournaments={cards}
      viewer={viewer}
      entryCounts={entryCounts}
      unreadNotifications={getUnreadCountSynced(viewer.userId)}
      initialEditEntryId={typeof editEntry === "string" ? editEntry : null}
    />
  );
}
