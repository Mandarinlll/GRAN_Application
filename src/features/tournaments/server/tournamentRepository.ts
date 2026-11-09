// tournaments テーブルへのアクセスの薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.4 / §5）に伴い、SQL・行→エンティティ/DTO 変換は
// tournaments/infrastructure/SqliteTournamentRepository へ移設し、読み取りビューは
// TournamentQueryService が提供する。本モジュールは、まだ OOP 化していない呼び出し元
// （app/(user)/tournaments/page.tsx が listPublicTournaments を参照）を壊さないための
// 薄い委譲ラッパとして、使用中の公開関数のみを残置する（SQL はこの層に残さない）。

import { db } from "@/lib/db";
import { SqliteTournamentRepository } from "@/features/tournaments/infrastructure/SqliteTournamentRepository";
import { TournamentQueryService } from "@/features/tournaments/application/TournamentQueryService";
import type { TournamentWithStats } from "@/features/tournaments/types/tournament";

const repository = new SqliteTournamentRepository(db);
const queryService = new TournamentQueryService(repository);

// 公開対象の大会一覧を取得する（統計付き・開催日昇順）。
export function listPublicTournaments(): TournamentWithStats[] {
  return queryService.listPublic();
}

// 大会を1件（統計付き）取得する。
export function findTournamentWithStats(
  tournamentId: string,
): TournamentWithStats | null {
  return queryService.findWithStats(tournamentId);
}
