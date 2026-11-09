// 大会の読み取りビュー（クエリ）を担うアプリケーションサービス（oop-architecture.md §2.5）。
//
// 現行 tournamentRepository.ts の listPublicTournaments / findTournamentWithStats に相当する
// 読み取りユースケースを提供する。戻り値は現行どおりプレーン DTO（TournamentWithStats）で、
// エンティティ/メソッドを "use server" 境界・Client Component へ渡さない（§2.1 境界ルール）。
// "use server" を持たない純 TypeScript クラスとする。

import type { TournamentRepository } from "@/features/tournaments/domain/TournamentRepository";
import type { TournamentWithStats } from "@/features/tournaments/types/tournament";

export class TournamentQueryService {
  constructor(private readonly tournaments: TournamentRepository) {}

  // 公開大会一覧（統計付き・開催日昇順）。
  listPublic(): TournamentWithStats[] {
    return this.tournaments.listPublicWithStats();
  }

  // 大会1件（統計付き）。無ければ null。
  findWithStats(tournamentId: string): TournamentWithStats | null {
    return this.tournaments.findWithStatsById(tournamentId);
  }
}
