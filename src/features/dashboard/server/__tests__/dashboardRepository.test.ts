import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "@/lib/db";
import { createDashboardRepository } from "../dashboardRepository";

let db: DatabaseSync;
// 2026-11-16 12:00 JST
const NOW = new Date("2026-11-16T03:00:00Z");

function tournament(id: string, date: string, status: string, fee = 1000) {
  db.prepare(
    `INSERT INTO tournaments (id,title,category,tier,event_date,start_time,venue,capacity,entry_fee,status,entry_start_at,entry_end_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, id, "SINGLES", "C", date, "09:00", "v", 16, fee, status, "2026-01-01 00:00:00", "2026-12-31 23:59:59");
}
function user(id: string) {
  db.prepare(
    `INSERT INTO users (id, login_id, email, password_hash, role, is_admin, status, is_initial_login,
       real_name, kana_name, nickname, gender, birth_date, phone_number, declared_class,
       gran_level, is_level_calibrated, rated_match_count)
     VALUES (?, ?, ?, 'h', 'USER', 0, 'ACTIVE', 0, 'テスト', 'テスト', 'テスト', 'MALE', '1995-04-01', '09000000000', 'C', 500, 1, 0)`,
  ).run(id, id, `${id}@x.jp`);
}
function entry(id: string, tid: string, uid: string, status: string, appliedAt: string) {
  db.prepare(
    `INSERT INTO entries (id,tournament_id,user_id,category,status,applied_at) VALUES (?,?,?,?,?,?)`,
  ).run(id, tid, uid, "SINGLES", status, appliedAt);
}

beforeEach(() => {
  db = openDatabase(":memory:");
  user("u1");
});
afterEach(() => db.close());

describe("ダッシュボード集計", () => {
  it("今日のエントリー数は当日0:00〜23:59:59の非キャンセルのみ数える", () => {
    tournament("t1", "2026-12-01", "OPEN");
    entry("e1", "t1", "u1", "CONFIRMED", "2026-11-16 00:00:00");
    entry("e2", "t1", "u1", "WAITING", "2026-11-16 23:59:59");
    entry("e3", "t1", "u1", "CANCELLED", "2026-11-16 10:00:00");
    entry("e4", "t1", "u1", "CONFIRMED", "2026-11-15 23:59:59");
    entry("e5", "t1", "u1", "CONFIRMED", "2026-11-17 00:00:00");
    expect(createDashboardRepository(db).getDashboard(NOW).todayEntries).toBe(2);
  });

  it("今月の売上予定は当月大会のエントリー×参加費+キャンセル料", () => {
    tournament("t1", "2026-11-30", "OPEN", 2000);
    tournament("t2", "2026-12-01", "OPEN", 2000);
    tournament("t3", "2026-11-01", "DRAFT", 2000);
    entry("e1", "t1", "u1", "CONFIRMED", "2026-11-01 10:00:00");
    entry("e2", "t1", "u1", "WAITING", "2026-11-01 10:00:00");
    entry("e3", "t1", "u1", "CANCELLED", "2026-11-01 10:00:00");
    entry("e4", "t2", "u1", "CONFIRMED", "2026-11-01 10:00:00");
    entry("e5", "t3", "u1", "CONFIRMED", "2026-11-01 10:00:00");
    db.prepare(
      `INSERT INTO cancellations (id,entry_id,days_before,fee_rate,fee_amount,is_paid,admin_status) VALUES ('c1','e3',4,50,1000,1,'UNCONTACTED')`,
    ).run();
    expect(createDashboardRepository(db).getDashboard(NOW).monthlySales).toBe(3000);
  });

  it("公開中の大会数は非公開・終了・中止を除く", () => {
    for (const [i, s] of ["DRAFT", "UPCOMING", "OPEN", "CLOSED", "FINISHED", "CANCELLED"].entries()) {
      tournament(`t${i}`, "2026-12-01", s);
    }
    expect(createDashboardRepository(db).getDashboard(NOW).openTournaments).toBe(3);
  });

  it("要対応タスクは有償キャンセルの未連絡・相談中", () => {
    tournament("t1", "2026-12-01", "OPEN");
    ["a", "b", "c", "d"].forEach((k) => entry(k, "t1", "u1", "CANCELLED", "2026-11-01 10:00:00"));
    const ins = db.prepare(
      `INSERT INTO cancellations (id,entry_id,days_before,fee_rate,fee_amount,is_paid,admin_status) VALUES (?,?,?,?,?,?,?)`,
    );
    ins.run("c1", "a", 4, 50, 1000, 1, "UNCONTACTED");
    ins.run("c2", "b", 4, 50, 1000, 1, "IN_CONSULTATION");
    ins.run("c3", "c", 4, 50, 1000, 1, "PAID_CONFIRMED");
    ins.run("c4", "d", 20, 0, 0, 0, "NOT_REQUIRED");
    expect(createDashboardRepository(db).getDashboard(NOW).pendingTasks).toBe(2);
  });

  it("推移は10日前〜当日の11点、直近大会は最大10件", () => {
    for (let i = 0; i < 12; i++) tournament(`t${i}`, `2026-11-${String(i + 5).padStart(2, "0")}`, "OPEN");
    entry("e1", "t0", "u1", "CONFIRMED", "2026-11-06 10:00:00");
    entry("e2", "t0", "u1", "CONFIRMED", "2026-11-05 10:00:00");
    const d = createDashboardRepository(db).getDashboard(NOW);
    expect(d.trend).toHaveLength(11);
    expect(d.trend[0].date).toBe("2026-11-06");
    expect(d.trend[0].count).toBe(1);
    expect(d.trend[10].date).toBe("2026-11-16");
    expect(d.tournaments).toHaveLength(10);
  });
});
