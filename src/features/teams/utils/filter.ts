// チーム一覧の種目・階級による絞り込み（純粋関数）。
import type { TeamListItem } from "@/features/teams/types/team";
import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

export function filterTeams(
  teams: TeamListItem[],
  category: TournamentCategory | "ALL",
  tier: TournamentTier | "ALL",
): TeamListItem[] {
  return teams.filter(
    (t) =>
      (category === "ALL" || t.categories.includes(category)) &&
      (tier === "ALL" || t.tier === tier),
  );
}
