// tournaments テーブルの永続化抽象（oop-architecture.md §2.4）。
//
// インターフェースをドメイン層に、実装（SqliteTournamentRepository）をインフラ層に置く。
// 単一・複数のエンティティ取得は Tournament エンティティを返す。読み取りビュー
// （集計付き TournamentWithStats）はプレーン DTO を返す（§2.1 境界ルール）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { Tournament } from "@/features/tournaments/domain/Tournament";
import type { TournamentWithStats } from "@/features/tournaments/types/tournament";

export interface TournamentRepository {
  // 大会を1件（統計なし）取得する。エンティティを返す。
  findById(tournamentId: string): Tournament | null;
  // 公開対象の大会一覧（統計付き DTO・開催日昇順）。
  listPublicWithStats(): TournamentWithStats[];
  // 大会を1件（統計付き DTO）取得する。
  findWithStatsById(tournamentId: string): TournamentWithStats | null;
  // 確定エントリー数を取得する（排他制御の定員チェックで使用）。
  countConfirmed(tournamentId: string): number;
}
