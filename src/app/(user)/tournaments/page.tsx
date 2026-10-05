// 大会日程・要項一覧ページ（URL: /tournaments）。
// サーバーコンポーネント。セッション検証 → 大会一覧と申込状況を取得し、
// クライアントコンポーネント（TournamentSchedule）へ表示用 DTO を渡す。
//
// 元モック: tests/schedule.html（データはベタ打ち）を、
// 実 DB（tournaments / entries / waitlists）に接続した本番実装へ置き換えたもの。

import { redirect } from "next/navigation";
import { listPublicTournaments } from "@/features/tournaments/server/tournamentRepository";
import { listInvolvedTournamentIds } from "@/features/entries/server/entryRepository";
import { getEntryViewer } from "@/features/entries/server/entryViewData";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import { formatEventDate, formatYen, isPastDate, monthOf } from "@/utils/date";
import { TournamentSchedule } from "@/features/tournaments/components/TournamentSchedule";

export default async function TournamentsPage() {
  // ログイン必須。
  const viewer = await getEntryViewer();
  if (!viewer) redirect("/login");

  // 公開大会一覧（昇順）を取得。
  const tournaments = listPublicTournaments();

  // ログインユーザー/チームが関与している大会IDの集合。
  const involved = listInvolvedTournamentIds({
    userId: viewer.userId,
    teamId: viewer.team?.id ?? null,
  });

  // 表示用 DTO へ変換。
  const cards: TournamentCardData[] = tournaments.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    tier: t.tier,
    eventDate: t.eventDate,
    eventDateLabel: formatEventDate(t.eventDate),
    month: monthOf(t.eventDate),
    startTime: t.startTime,
    endTime: t.endTime,
    venue: t.venue,
    courtInfo: t.courtInfo,
    description: t.description,
    imageUrl: t.imageUrl,
    capacity: t.capacity,
    teamSizeMin: t.teamSizeMin,
    teamSizeMax: t.teamSizeMax,
    entryFee: t.entryFee,
    entryFeeLabel: formatYen(t.entryFee),
    status: t.status,
    entryStartAt: t.entryStartAt,
    entryEndAt: t.entryEndAt,
    confirmedCount: t.confirmedCount,
    waitingCount: t.waitingCount,
    remaining: t.remaining,
    capacityStatus: t.capacityStatus,
    isPast: isPastDate(t.eventDate),
    isEntered: involved.has(t.id),
  }));

  return <TournamentSchedule tournaments={cards} viewer={viewer} />;
}
