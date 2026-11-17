// 管理ダッシュボード（/admin）用の集計リポジトリ。
//
// 日時は DB と同じく JST の文字列（"YYYY-MM-DD HH:MM:SS"）で扱う。
// 集計の定義:
//  - 今日のエントリー数  : 申込日時(applied_at)が当日 0:00:00〜23:59:59 のエントリー（キャンセル済みを除く）
//  - 今月の売上予定      : 開催日が当月の大会（下書き・中止を除く）の
//                          有効エントリー数(CONFIRMED/ATTENDED) × 参加費 + キャンセル料(有償)の合計
//  - 公開中の大会数      : status が DRAFT(非公開)・FINISHED(終了)・CANCELLED(中止) 以外
//  - 要対応タスク        : 有償キャンセルで管理者対応が未完了（未連絡・相談中）の件数
//  - エントリー数推移    : 10日前〜当日の日別エントリー数（キャンセル済みを除く、計11点）
//  - 直近10大会          : 開催日が今日に最も近い非公開以外の10大会（開催日昇順で表示）。
//                          エントリー数はキャンセル・キャンセル待ちを除く(CONFIRMED/ATTENDED)
import type { DatabaseSync } from "node:sqlite";
import { db as sharedDb } from "@/lib/db";
import type { DashboardData } from "../types/dashboard";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const TREND_DAYS = 10;
const RECENT_TOURNAMENTS = 10;

// Date を JST の "YYYY-MM-DD" へ。
function toJstDate(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" に日数を加減する（UTC 計算なので夏時間等の影響なし）。
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface DashboardRepository {
  getDashboard(now?: Date): DashboardData;
}

export function createDashboardRepository(db: DatabaseSync): DashboardRepository {
  return {
    getDashboard(now = new Date()) {
      const today = toJstDate(now);
      const monthStart = `${today.slice(0, 7)}-01`;
      const nextMonthStart = (() => {
        const [y, m] = today.split("-").map(Number);
        return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      })();

      // 1. 今日のエントリー数
      const todayEntries = (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM entries
              WHERE status <> 'CANCELLED'
                AND applied_at >= ? AND applied_at <= ?`,
          )
          .get(`${today} 00:00:00`, `${today} 23:59:59`) as { n: number }
      ).n;

      // 2. 今月の売上予定
      const entrySales = (
        db
          .prepare(
            `SELECT COALESCE(SUM(t.entry_fee), 0) AS n
               FROM entries e JOIN tournaments t ON t.id = e.tournament_id
              WHERE e.status IN ('CONFIRMED','ATTENDED')
                AND t.status NOT IN ('DRAFT','CANCELLED')
                AND t.event_date >= ? AND t.event_date < ?`,
          )
          .get(monthStart, nextMonthStart) as { n: number }
      ).n;
      const cancelFees = (
        db
          .prepare(
            `SELECT COALESCE(SUM(c.fee_amount), 0) AS n
               FROM cancellations c
               JOIN entries e ON e.id = c.entry_id
               JOIN tournaments t ON t.id = e.tournament_id
              WHERE c.fee_amount > 0
                AND t.status NOT IN ('DRAFT','CANCELLED')
                AND t.event_date >= ? AND t.event_date < ?`,
          )
          .get(monthStart, nextMonthStart) as { n: number }
      ).n;

      // 3. 公開中の大会数
      const openTournaments = (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM tournaments
              WHERE status NOT IN ('DRAFT','FINISHED','CANCELLED')`,
          )
          .get() as { n: number }
      ).n;

      // 4. 要対応タスク（有償キャンセルへの連絡）
      const pendingTasks = (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM cancellations
              WHERE is_paid = 1
                AND admin_status IN ('UNCONTACTED','IN_CONSULTATION')`,
          )
          .get() as { n: number }
      ).n;

      // 5. 日別エントリー数
      const from = addDays(today, -TREND_DAYS);
      const perDay = db
        .prepare(
          `SELECT substr(applied_at, 1, 10) AS day, COUNT(*) AS n
             FROM entries
            WHERE status <> 'CANCELLED'
              AND applied_at >= ? AND applied_at <= ?
            GROUP BY day`,
        )
        .all(`${from} 00:00:00`, `${today} 23:59:59`) as { day: string; n: number }[];
      const dayMap = new Map(perDay.map((r) => [r.day, r.n]));
      const trend = Array.from({ length: TREND_DAYS + 1 }, (_, i) => {
        const date = addDays(from, i);
        return { date, count: dayMap.get(date) ?? 0 };
      });

      // 6. 直近10大会のエントリー状況
      const recent = db
        .prepare(
          `SELECT t.id, t.title, t.short_title, t.event_date, t.capacity,
                  COALESCE(SUM(CASE WHEN e.status IN ('CONFIRMED','ATTENDED') THEN 1 ELSE 0 END), 0) AS confirmed
             FROM tournaments t LEFT JOIN entries e ON e.tournament_id = t.id
            WHERE t.status <> 'DRAFT'
            GROUP BY t.id
            ORDER BY ABS(julianday(t.event_date) - julianday(?)) ASC, t.event_date DESC
            LIMIT ?`,
        )
        .all(today, RECENT_TOURNAMENTS) as {
        id: string;
        title: string;
        short_title: string | null;
        event_date: string;
        capacity: number;
        confirmed: number;
      }[];
      const tournaments = recent
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
        .map((r) => ({
          id: r.id,
          title: r.short_title || r.title,
          eventDate: r.event_date,
          capacity: r.capacity,
          entries: r.confirmed,
        }));

      return {
        todayEntries,
        monthlySales: entrySales + cancelFees,
        openTournaments,
        pendingTasks,
        trend,
        tournaments,
      };
    },
  };
}

// アプリ共有 DB を使うリポジトリ。
export const dashboardRepository = createDashboardRepository(sharedDb);
