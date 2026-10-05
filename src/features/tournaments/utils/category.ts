// 種目区分に応じた申込ルールの判定ヘルパー。
// requirements-detail-user.md 3.1 準拠。
//   - シングルス          : 個人で申込（本人のみ）
//   - ダブルス            : 代表者のみ申込（2名）
//   - 団体戦（男女/ミックス）: 代表者のみ申込（大会指定の 4〜6 名）

import type { TournamentCategory } from "@/features/tournaments/types/tournament";

// 団体戦系（代表者のみ・チーム必須）か。
export function isTeamCategory(category: TournamentCategory): boolean {
  return (
    category === "MEN_TEAM" ||
    category === "WOMEN_TEAM" ||
    category === "MIX_TEAM"
  );
}

// 代表者（LEADER）でなければ申込できない種目か（ダブルス・団体戦）。
export function requiresLeader(category: TournamentCategory): boolean {
  return isTeamCategory(category) || category === "DOUBLES";
}

// チーム（team_id）の指定が必須の種目か。
// ダブルスも代表者がチームを母体に申込む想定のためチーム必須とする。
export function requiresTeam(category: TournamentCategory): boolean {
  return requiresLeader(category);
}

// 種目ごとに必要なメンバー人数（最小・最大）を返す。
// 団体戦は大会側の team_size_min/max を優先し、無指定時はこの既定を使う。
export function memberCountRange(
  category: TournamentCategory,
  teamSizeMin: number | null,
  teamSizeMax: number | null,
): { min: number; max: number } {
  if (category === "SINGLES") return { min: 1, max: 1 };
  if (category === "DOUBLES") return { min: 2, max: 2 };
  // 団体戦: 大会指定があればそれを使う。無指定なら 4〜6 名（仕様の既定）。
  return {
    min: teamSizeMin ?? 4,
    max: teamSizeMax ?? 6,
  };
}
