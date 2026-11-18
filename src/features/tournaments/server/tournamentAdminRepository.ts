// 管理者向け大会管理のリポジトリ。SQL はこの層にのみ閉じ込める。
// - すべてバインド変数（文字列連結で値を埋め込まない）。
// - 編集・ステータス変更は updated_at による楽観ロック。
// - 確定エントリー数の定義は CONFIRMED_ENTRY_SQL に集約する（要件の用語集どおり CONFIRMED のみ）。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type {
  AdminTournament,
  AdminTournamentListRow,
  AdminTournamentStats,
  StatResult,
  TournamentInput,
} from "@/features/tournaments/types/adminTournament";
import type {
  TournamentCategory,
  TournamentStatus,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// 確定エントリーの判定条件（entries のエイリアスは e）。
// ユーザー向け画面（CONFIRMED + ATTENDED）と揃える場合はここだけを変更する。
export const CONFIRMED_ENTRY_SQL = "e.status = 'CONFIRMED'";

interface AdminTournamentRow {
  id: string;
  title: string;
  short_title: string | null;
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
  prize: string | null;
  surface: AdminTournament["surface"];
  series_id: string | null;
  gender_division: AdminTournament["genderDivision"];
  created_at: string;
  updated_at: string;
}

function toAdminTournament(row: AdminTournamentRow): AdminTournament {
  return {
    id: row.id,
    title: row.title,
    shortTitle: row.short_title,
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
    prize: row.prize,
    surface: row.surface,
    seriesId: row.series_id,
    genderDivision: row.gender_division,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 大会を 1 件取得する（存在しなければ null）。
export function findAdminTournamentById(id: string): AdminTournament | null {
  const row = db
    .prepare("SELECT * FROM tournaments WHERE id = ?")
    .get(id) as unknown as AdminTournamentRow | undefined;
  return row ? toAdminTournament(row) : null;
}

// 一覧行を全件取得する（並び順・絞り込みはクライアント側の純粋関数で行う）。
export function listAdminTournamentRows(): AdminTournamentListRow[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.event_date, t.category, t.tier, t.status, t.venue,
              t.capacity, t.entry_fee, t.entry_start_at, t.alert_threshold,
              (SELECT COUNT(*) FROM entries e
                 WHERE e.tournament_id = t.id AND ${CONFIRMED_ENTRY_SQL}) AS confirmed_count
         FROM tournaments t`,
    )
    .all() as unknown as Array<{
    id: string;
    title: string;
    event_date: string;
    category: TournamentCategory;
    tier: TournamentTier;
    status: TournamentStatus;
    venue: string;
    capacity: number;
    entry_fee: number;
    entry_start_at: string;
    alert_threshold: number | null;
    confirmed_count: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    eventDate: r.event_date,
    category: r.category,
    tier: r.tier,
    status: r.status,
    venue: r.venue,
    capacity: r.capacity,
    confirmedCount: r.confirmed_count,
    entryFee: r.entry_fee,
    entryStartAt: r.entry_start_at,
    alertThreshold: r.alert_threshold,
  }));
}

export interface InsertOptions {
  imageUrl?: string | null;
  copyFromId?: string | null;
}

const INSERT_SQL = `INSERT INTO tournaments (
    id, title, category, tier, event_date, start_time, end_time, venue, court_info,
    image_url, description, capacity, team_size_min, team_size_max, entry_fee, status,
    entry_start_at, entry_end_at, copy_from_id, alert_threshold, prize, surface,
    series_id, gender_division, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?,
    ${NOW_JST}, ${NOW_JST})`;

// 1 件を DRAFT で INSERT する。created_at と updated_at は同じ式で設定する。
// トランザクションは呼び出し側が管理する（単体呼び出しは 1 文で原子的）。
export function insertTournament(
  input: TournamentInput,
  options: InsertOptions = {},
): string {
  const id = randomUUID();
  db.prepare(INSERT_SQL).run(
    id,
    input.title,
    input.category,
    input.tier,
    input.eventDate,
    input.startTime,
    input.endTime,
    input.venue,
    input.courtInfo,
    options.imageUrl ?? null,
    input.description,
    input.capacity,
    input.teamSizeMin,
    input.teamSizeMax,
    input.entryFee,
    input.entryStartAt,
    input.entryEndAt,
    options.copyFromId ?? null,
    input.alertThreshold,
    input.prize,
    input.surface,
    input.seriesId,
    input.genderDivision,
  );
  return id;
}

// 一括 INSERT。全件を 1 トランザクションで保存し、1 件でも失敗すれば全件ロールバックする。
export function insertTournamentsBulk(
  items: Array<{ input: TournamentInput; imageUrl?: string | null }>,
): string[] {
  db.exec("BEGIN");
  try {
    const ids = items.map((it) =>
      insertTournament(it.input, { imageUrl: it.imageUrl ?? null }),
    );
    db.exec("COMMIT");
    return ids;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ロールバック失敗は元の例外を優先する
    }
    throw e;
  }
}

export interface UpdateOptions {
  // undefined: image_url を変更しない / null または文字列: その値で更新する
  imageUrl?: string | null;
}

// 楽観ロックつき更新。updated_at が一致しなければ変更せず false を返す。
export function updateTournamentRow(
  id: string,
  input: TournamentInput,
  expectedUpdatedAt: string,
  options: UpdateOptions = {},
): boolean {
  const changeImage = options.imageUrl !== undefined ? 1 : 0;
  const result = db
    .prepare(
      `UPDATE tournaments SET
         title = ?, category = ?, tier = ?, event_date = ?, start_time = ?, end_time = ?,
         venue = ?, court_info = ?, description = ?, capacity = ?, team_size_min = ?,
         team_size_max = ?, entry_fee = ?, entry_start_at = ?, entry_end_at = ?,
         alert_threshold = ?, prize = ?, surface = ?, series_id = ?, gender_division = ?,
         image_url = CASE WHEN ? = 1 THEN ? ELSE image_url END,
         updated_at = ${NOW_JST}
       WHERE id = ? AND updated_at = ?`,
    )
    .run(
      input.title,
      input.category,
      input.tier,
      input.eventDate,
      input.startTime,
      input.endTime,
      input.venue,
      input.courtInfo,
      input.description,
      input.capacity,
      input.teamSizeMin,
      input.teamSizeMax,
      input.entryFee,
      input.entryStartAt,
      input.entryEndAt,
      input.alertThreshold,
      input.prize,
      input.surface,
      input.seriesId,
      input.genderDivision,
      changeImage,
      options.imageUrl ?? null,
      id,
      expectedUpdatedAt,
    );
  return Number(result.changes) > 0;
}

// 大会を物理削除する。削除できたら true。
export function deleteTournamentRow(id: string): boolean {
  const result = db.prepare("DELETE FROM tournaments WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}

// この大会を copy_from_id で参照している大会があるか。
export function hasCopyReferences(id: string): boolean {
  const row = db
    .prepare("SELECT 1 AS x FROM tournaments WHERE copy_from_id = ? LIMIT 1")
    .get(id);
  return row !== undefined;
}

// 状態を問わずエントリーが 1 件でもあるか。
export function hasAnyEntries(id: string): boolean {
  const row = db
    .prepare("SELECT 1 AS x FROM entries WHERE tournament_id = ? LIMIT 1")
    .get(id);
  return row !== undefined;
}

// 確定エントリー数（CONFIRMED_ENTRY_SQL の定義）。
export function countConfirmed(id: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM entries e
        WHERE e.tournament_id = ? AND ${CONFIRMED_ENTRY_SQL}`,
    )
    .get(id) as { c: number };
  return row.c;
}

// 1 件の統計取得。失敗しても例外にせず { ok: false } にして、他の項目に影響させない（Requirement 11.8）。
function safeCount(sql: string, id: string): StatResult<number> {
  try {
    const row = db.prepare(sql).get(id) as { c: number } | undefined;
    return { ok: true, value: Number(row?.c ?? 0) };
  } catch {
    return { ok: false };
  }
}

// 大会詳細の統計。5 項目を個別クエリで取得する。
// - 確定数: CONFIRMED_ENTRY_SQL の定義
// - 待ち数: waitlists.status = 'WAITING'
// - 請求中キャンセル: cancellations.is_paid = 1 かつ admin_status が UNCONTACTED / IN_CONSULTATION
// - 入金済み・未入金: CONFIRMED / ATTENDED のエントリーの payment_status
export function getAdminTournamentStats(id: string): AdminTournamentStats {
  return {
    confirmedCount: safeCount(
      `SELECT COUNT(*) AS c FROM entries e
        WHERE e.tournament_id = ? AND ${CONFIRMED_ENTRY_SQL}`,
      id,
    ),
    waitingCount: safeCount(
      `SELECT COUNT(*) AS c FROM waitlists w
        WHERE w.tournament_id = ? AND w.status = 'WAITING'`,
      id,
    ),
    billingCancellationCount: safeCount(
      `SELECT COUNT(*) AS c FROM cancellations c
          JOIN entries e ON e.id = c.entry_id
        WHERE e.tournament_id = ? AND c.is_paid = 1
          AND c.admin_status IN ('UNCONTACTED','IN_CONSULTATION')`,
      id,
    ),
    paidCount: safeCount(
      `SELECT COUNT(*) AS c FROM entries e
        WHERE e.tournament_id = ? AND e.status IN ('CONFIRMED','ATTENDED')
          AND e.payment_status = 'PAID'`,
      id,
    ),
    unpaidCount: safeCount(
      `SELECT COUNT(*) AS c FROM entries e
        WHERE e.tournament_id = ? AND e.status IN ('CONFIRMED','ATTENDED')
          AND e.payment_status = 'UNPAID'`,
      id,
    ),
  };
}
