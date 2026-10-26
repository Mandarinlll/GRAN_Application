// tournaments テーブルへのアクセスを集約するリポジトリ。
// SQL はこの層にのみ閉じ込める（コーディング規約 6）。
// 残枠はエントリー確定数（entries.status = 'CONFIRMED'）との差分で算出する。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type {
  Tournament,
  TournamentCategory,
  TournamentStatus,
  TournamentTier,
  TournamentWithStats,
} from "@/features/tournaments/types/tournament";
import {
  calcCapacityStatus,
  calcRemaining,
} from "@/features/tournaments/utils/capacity";

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

function toTournament(row: TournamentRow): Tournament {
  return {
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
  };
}

// 行 + 集計カラム（confirmed_count / waiting_count）→ 統計付きビューモデル。
function toTournamentWithStats(
  row: TournamentRow & { confirmed_count: number; waiting_count: number },
): TournamentWithStats {
  const base = toTournament(row);
  const confirmedCount = row.confirmed_count;
  const waitingCount = row.waiting_count;
  const remaining = calcRemaining(base.capacity, confirmedCount);
  const capacityStatus = calcCapacityStatus(base.capacity, confirmedCount);
  return { ...base, confirmedCount, waitingCount, remaining, capacityStatus };
}

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

// 公開対象の大会一覧を取得する（DRAFT は除外）。
// 初期ソートは開催日の昇順（requirements-detail-user.md 2.1）。
// 絞り込み（月・種目・階級・ステータス）はアプリ側（Server Component）で行い、
// ここでは DB からの一次取得（公開 + 昇順）に責務を限定する。
export function listPublicTournaments(): TournamentWithStats[] {
  const rows = db
    .prepare(
      `${LIST_SELECT}
        WHERE t.status != 'DRAFT'
        ORDER BY t.event_date ASC, t.start_time ASC`,
    )
    .all() as Array<
    TournamentRow & { confirmed_count: number; waiting_count: number }
  >;
  return rows.map(toTournamentWithStats);
}

// 大会を1件（統計付き）取得する。
export function findTournamentWithStats(
  tournamentId: string,
): TournamentWithStats | null {
  const row = db
    .prepare(`${LIST_SELECT} WHERE t.id = ?`)
    .get(tournamentId) as
    | (TournamentRow & { confirmed_count: number; waiting_count: number })
    | undefined;
  return row ? toTournamentWithStats(row) : null;
}

// 大会を1件（統計なし）取得する。
export function findTournamentById(tournamentId: string): Tournament | null {
  const row = db
    .prepare("SELECT * FROM tournaments WHERE id = ?")
    .get(tournamentId) as TournamentRow | undefined;
  return row ? toTournament(row) : null;
}

// 確定エントリー数を取得する（排他制御の定員チェックで使用）。
export function countConfirmedEntries(tournamentId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entries
        WHERE tournament_id = ? AND status IN ('CONFIRMED','ATTENDED')`,
    )
    .get(tournamentId) as { c: number };
  return row.c;
}

// --- シード・テスト用の作成系（本番の大会登録機能は別スコープ） ---

export interface CreateTournamentParams {
  title: string;
  category: TournamentCategory;
  tier: TournamentTier;
  eventDate: string;
  startTime: string;
  endTime?: string | null;
  venue: string;
  courtInfo?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  capacity: number;
  teamSizeMin?: number | null;
  teamSizeMax?: number | null;
  entryFee: number;
  status: TournamentStatus;
  entryStartAt: string;
  entryEndAt: string;
  alertThreshold?: number | null;
}

export function createTournament(params: CreateTournamentParams): Tournament {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tournaments (
      id, title, category, tier, event_date, start_time, end_time,
      venue, court_info, image_url, description, capacity,
      team_size_min, team_size_max, entry_fee, status,
      entry_start_at, entry_end_at, alert_threshold, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
  ).run(
    id,
    params.title,
    params.category,
    params.tier,
    params.eventDate,
    params.startTime,
    params.endTime ?? null,
    params.venue,
    params.courtInfo ?? null,
    params.imageUrl ?? null,
    params.description ?? null,
    params.capacity,
    params.teamSizeMin ?? null,
    params.teamSizeMax ?? null,
    params.entryFee,
    params.status,
    params.entryStartAt,
    params.entryEndAt,
    params.alertThreshold ?? null,
  );
  const row = db
    .prepare("SELECT * FROM tournaments WHERE id = ?")
    .get(id) as TournamentRow;
  return toTournament(row);
}

// シード冪等化用: 既存の大会件数を返す。
export function countTournaments(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM tournaments").get() as {
    c: number;
  };
  return row.c;
}
