// TournamentRepository の SQLite 実装（oop-architecture.md §2.4）。
// SQL はこの層にのみ閉じ込める（既存規約 §6）。
//
// 現行 tournaments/server/tournamentRepository.ts の SQL・行→エンティティ変換を移植した。
// 集計付きビュー（TournamentWithStats）は Tournament エンティティの remaining /
// capacityStatus で派生値を算出し、プレーン DTO へ変換して返す（§2.1 境界ルール）。

import type { DatabaseSync } from "node:sqlite";
import type {
  TournamentCategory,
  TournamentStatus,
  TournamentTier,
  TournamentWithStats,
} from "@/features/tournaments/types/tournament";
import { Tournament } from "@/features/tournaments/domain/Tournament";
import type { TournamentRepository } from "@/features/tournaments/domain/TournamentRepository";

interface TournamentRow {
  id: string;
  title: string;
  category: TournamentCategory;
  tier: TournamentTier;
  event_date: string;
  start_time: string;
  end_time: string | null;
  venue: string;
  court_info: string | null;
  image_url: string | null;
  description: string | null;
  capacity: number;
  team_size_min: number | null;
  team_size_max: number | null;
  entry_fee: number;
  status: TournamentStatus;
  entry_start_at: string;
  entry_end_at: string;
  copy_from_id: string | null;
  alert_threshold: number | null;
  draw_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

type StatsRow = TournamentRow & {
  confirmed_count: number;
  waiting_count: number;
};

// 一覧取得時の集計を含む共通 SELECT。
// entries 確定数（CONFIRMED/ATTENDED）とキャンセル待ち数をサブクエリで数える。
const LIST_SELECT = `
  SELECT t.*,
    (SELECT COUNT(*) FROM entries e
       WHERE e.tournament_id = t.id AND e.status IN ('CONFIRMED','ATTENDED')) AS confirmed_count,
    (SELECT COUNT(*) FROM waitlists w
       WHERE w.tournament_id = t.id AND w.status IN ('WAITING','OFFERED')) AS waiting_count
  FROM tournaments t
`;

export class SqliteTournamentRepository implements TournamentRepository {
  constructor(private readonly db: DatabaseSync) {}

  // 行 → Tournament エンティティ（rehydrate）。
  private toTournament(row: TournamentRow): Tournament {
    return new Tournament({
      id: row.id,
      title: row.title,
      category: row.category,
      tier: row.tier,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      venue: row.venue,
      courtInfo: row.court_info,
      imageUrl: row.image_url,
      description: row.description,
      capacity: row.capacity,
      teamSizeMin: row.team_size_min,
      teamSizeMax: row.team_size_max,
      entryFee: row.entry_fee,
      status: row.status,
      entryStartAt: row.entry_start_at,
      entryEndAt: row.entry_end_at,
      copyFromId: row.copy_from_id,
      alertThreshold: row.alert_threshold,
      drawPdfUrl: row.draw_pdf_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  // 行 + 集計カラム → 統計付きビューモデル（プレーン DTO）。
  // remaining / capacityStatus はエンティティのメソッドで算出するが、DTO として返す。
  private toTournamentWithStats(row: StatsRow): TournamentWithStats {
    const entity = this.toTournament(row);
    const confirmedCount = row.confirmed_count;
    const waitingCount = row.waiting_count;
    return {
      id: entity.id,
      title: entity.title,
      category: entity.category,
      tier: entity.tier,
      eventDate: entity.eventDate,
      startTime: entity.startTime,
      endTime: entity.endTime,
      venue: entity.venue,
      courtInfo: entity.courtInfo,
      imageUrl: entity.imageUrl,
      description: entity.description,
      capacity: entity.capacity,
      teamSizeMin: entity.teamSizeMin,
      teamSizeMax: entity.teamSizeMax,
      entryFee: entity.entryFee,
      status: entity.status,
      entryStartAt: entity.entryStartAt,
      entryEndAt: entity.entryEndAt,
      copyFromId: entity.copyFromId,
      alertThreshold: entity.alertThreshold,
      drawPdfUrl: entity.drawPdfUrl,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      confirmedCount,
      waitingCount,
      remaining: entity.remaining(confirmedCount),
      capacityStatus: entity.capacityStatus(confirmedCount),
    };
  }

  findById(tournamentId: string): Tournament | null {
    const row = this.db
      .prepare("SELECT * FROM tournaments WHERE id = ?")
      .get(tournamentId) as TournamentRow | undefined;
    return row ? this.toTournament(row) : null;
  }

  // 公開対象の大会一覧を取得する（DRAFT は除外）。
  // 初期ソートは開催日の昇順（requirements-detail-user.md 2.1）。
  listPublicWithStats(): TournamentWithStats[] {
    const rows = this.db
      .prepare(
        `${LIST_SELECT}
        WHERE t.status != 'DRAFT'
        ORDER BY t.event_date ASC, t.start_time ASC`,
      )
      .all() as StatsRow[];
    return rows.map((row) => this.toTournamentWithStats(row));
  }

  findWithStatsById(tournamentId: string): TournamentWithStats | null {
    const row = this.db
      .prepare(`${LIST_SELECT} WHERE t.id = ?`)
      .get(tournamentId) as StatsRow | undefined;
    return row ? this.toTournamentWithStats(row) : null;
  }

  countConfirmed(tournamentId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM entries
        WHERE tournament_id = ? AND status IN ('CONFIRMED','ATTENDED')`,
      )
      .get(tournamentId) as { c: number };
    return row.c;
  }
}
