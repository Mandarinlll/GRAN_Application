// 種目区分に応じた申込ルールの判定ヘルパー。
// requirements-detail-user.md 3.1 準拠。
//   - シングルス          : 個人で申込（本人のみ）
//   - ダブルス            : 代表者のみ申込（2名）
//   - 団体戦（男女/ミックス）: 代表者のみ申込（大会指定の 4〜6 名）
//
// OOP 化（oop-architecture.md §5）に伴い、判定ロジックは
// tournaments/domain/CategoryRules（静的ルール）と entries/domain/MemberComposition（人数レンジ）へ
// 移設した。本モジュールは FEAT-003（tournaments）着手までの間、既存呼び出し元
// （tournaments / auth）を壊さないための薄い委譲ラッパとして残置する。

import type { TournamentCategory } from "@/features/tournaments/types/tournament";
import { CategoryRules } from "@/features/tournaments/domain/CategoryRules";
import { MemberComposition } from "@/features/entries/domain/MemberComposition";

// 団体戦系（代表者のみ・チーム必須）か。
export function isTeamCategory(category: TournamentCategory): boolean {
  return CategoryRules.isTeamCategory(category);
}

// 代表者（LEADER）でなければ申込できない種目か（ダブルス・団体戦）。
export function requiresLeader(category: TournamentCategory): boolean {
  return CategoryRules.requiresLeader(category);
}

// チーム（team_id）の指定が必須の種目か。
export function requiresTeam(category: TournamentCategory): boolean {
  return CategoryRules.requiresTeam(category);
}

// 種目ごとに必要なメンバー人数（最小・最大）を返す。
export function memberCountRange(
  category: TournamentCategory,
  teamSizeMin: number | null,
  teamSizeMax: number | null,
): { min: number; max: number } {
  return MemberComposition.countRange(category, teamSizeMin, teamSizeMax);
}
