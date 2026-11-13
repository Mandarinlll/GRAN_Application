import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type { GenderDivision, ResultRank } from "../types/dto";

export interface ParticipationRowBase {
  eventDate: string; // "YYYY-MM-DD"
  genderDivision: GenderDivision | null;
  tier: TournamentTier;
}

export interface ParticipationFilter {
  division?: GenderDivision;
  tier?: TournamentTier;
  year?: number;
}

/** 指定された全条件を満たす行のみを返す（未指定の条件は無視）。 */
export function filterParticipations<T extends ParticipationRowBase>(
  rows: T[],
  f: ParticipationFilter,
): T[] {
  return rows.filter((r) => {
    if (f.division !== undefined) {
      if (r.genderDivision !== f.division) return false;
    }
    if (f.tier !== undefined && r.tier !== f.tier) return false;
    if (f.year !== undefined && Number(r.eventDate.slice(0, 4)) !== f.year) {
      return false;
    }
    return true;
  });
}

/** 開催日で並べ替えた新しい配列を返す（元配列は変更しない）。 */
export function sortParticipations<T extends { eventDate: string }>(
  rows: T[],
  order: "asc" | "desc",
): T[] {
  const sign = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) =>
    a.eventDate < b.eventDate ? -sign : a.eventDate > b.eventDate ? sign : 0,
  );
}

const RESULT_LABELS: Record<ResultRank, string> = {
  PARTICIPATED: "参加",
  L2_WINNER: "2位トーナメント優勝",
  T1_RUNNER_UP: "1位トーナメント準優勝",
  T1_WINNER: "1位トーナメント優勝",
};

export function resultLabel(rank: ResultRank | null): string {
  if (rank === null) return "未確定";
  return RESULT_LABELS[rank] ?? "未確定";
}
