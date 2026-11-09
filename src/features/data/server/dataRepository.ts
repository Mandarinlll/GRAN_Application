// データタブ（GRAN_Data_Tab）のデータアクセスの薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.4 / §5）に伴い、SQL・行→DTO 変換・tournament_results の
// 防御的フォールバックは data/infrastructure/SqliteDataRepository へ移設した。本モジュールは、
// まだ OOP 化前の呼び出し元（dataRepository.*.test.ts の統合テスト群が各 SELECT 関数を参照）を
// 壊さないための薄い委譲ラッパとして公開関数を残置する（SQL はこの層に残さない）。

import { db } from "@/lib/db";
import { SqliteDataRepository } from "@/features/data/infrastructure/SqliteDataRepository";
import type { TournamentTier } from "@/features/tournaments/types/tournament";
import type {
  EntryHistoryRow,
  LevelHistoryPoint,
  PerformanceSummary,
  RankableUser,
  TeamRatingRow,
} from "@/features/data/types/data";

const repository = new SqliteDataRepository(db);

export function listPersonalRanking(): RankableUser[] {
  return repository.listPersonalRanking();
}

export function listTierRanking(tier: TournamentTier): RankableUser[] {
  return repository.listTierRanking(tier);
}

export function listTeamRatingRows(): TeamRatingRow[] {
  return repository.listTeamRatingRows();
}

export function listCalibratedLevels(): number[] {
  return repository.listCalibratedLevels();
}

export function countUncalibratedUsers(): number {
  return repository.countUncalibratedUsers();
}

export function getLevelHistory(userId: string): LevelHistoryPoint[] {
  return repository.getLevelHistory(userId);
}

export function listEntryHistory(userId: string): EntryHistoryRow[] {
  return repository.listEntryHistory(userId);
}

export function getPerformanceSummary(userId: string): PerformanceSummary {
  return repository.getPerformanceSummary(userId);
}
