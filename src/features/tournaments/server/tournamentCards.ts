// 大会日程ページ・ホーム（カレンダー）で共通利用する、大会カード表示用 DTO の組み立て。
// Server Component から呼び出す。
import { listPublicTournaments } from "@/features/tournaments/server/tournamentRepository";
import { listInvolvedTournamentIds } from "@/features/entries/server/entryRepository";
import type { EntryViewer } from "@/features/entries/server/entryViewData";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import { formatEventDate, formatYen, isPastDate, monthOf } from "@/utils/date";

export function listTournamentCards(viewer: EntryViewer): TournamentCardData[] {
  // ログインユーザー/チームが関与している大会IDの集合。
  const involved = listInvolvedTournamentIds({
    userId: viewer.userId,
    teamId: viewer.team?.id ?? null,
  });
  return listPublicTournaments().map((t) => ({
    id: t.id,
    title: t.title,
    shortTitle: t.shortTitle,
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
}