// サーバー側のデータからフォーム初期値を作る（純粋関数）。
import type { TournamentFormValues } from "./TournamentForm";
import type { AdminTournament } from "@/features/tournaments/types/adminTournament";
import type { CopyDefaults } from "@/features/tournaments/utils/copyDefaults";

type Source = Pick<
  AdminTournament | CopyDefaults,
  | "title" | "eventDate" | "category" | "tier" | "venue" | "capacity" | "entryFee" | "description"
  | "prize" | "courtInfo" | "teamSizeMin" | "teamSizeMax" | "alertThreshold" | "surface" | "seriesId" | "genderDivision"
> & { startTime: string; endTime: string | null; entryStartAt: string; entryEndAt: string };

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
// "YYYY-MM-DD HH:mm:ss" → datetime-local 用 "YYYY-MM-DDTHH:mm"
const toLocal = (v: string) => (v ? v.slice(0, 16).replace(" ", "T") : "");

export function toFormValues(s: Source): TournamentFormValues {
  return {
    title: s.title,
    eventDate: s.eventDate,
    category: s.category,
    tier: s.tier,
    venue: s.venue,
    capacity: str(s.capacity),
    entryFee: str(s.entryFee),
    startTime: s.startTime,
    endTime: str(s.endTime),
    entryStartAt: toLocal(s.entryStartAt),
    entryEndAt: toLocal(s.entryEndAt),
    description: str(s.description),
    prize: str(s.prize),
    courtInfo: str(s.courtInfo),
    teamSizeMin: str(s.teamSizeMin),
    teamSizeMax: str(s.teamSizeMax),
    alertThreshold: str(s.alertThreshold),
    surface: str(s.surface),
    seriesId: str(s.seriesId),
    genderDivision: str(s.genderDivision),
  };
}
