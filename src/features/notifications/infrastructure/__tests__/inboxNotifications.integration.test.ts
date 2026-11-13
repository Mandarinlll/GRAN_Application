// 通知受信箱の結合テスト。インメモリ SQLite に必要最小限のスキーマを作り、
// SqliteInboxNotificationRepository + InboxNotificationService を実際に動かして検証する。
// （@/lib/db の共有 DB ファイルは使わない。）

import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { SqliteUnitOfWork } from "@/lib/unitOfWork";
import { SqliteInboxNotificationRepository } from "@/features/notifications/infrastructure/SqliteInboxNotificationRepository";
import { InboxNotificationService } from "@/features/notifications/application/InboxNotificationService";

let db: DatabaseSync;
let service: InboxNotificationService;

// 2026-09-20 開催の大会に、ユーザー u1 が確定エントリー（2026-08-01 申込）。
function seed(memberTypes: Array<"REGISTERED" | "GUEST" | "PENDING"> = []) {
  db.exec(`
    INSERT INTO users (id) VALUES ('u1'), ('u2');
    INSERT INTO tournaments (id, title, event_date, status)
      VALUES ('t1', '秋季ミックス団体戦', '2026-09-20', 'OPEN');
    INSERT INTO entries (id, tournament_id, user_id, status, applied_at)
      VALUES ('e1', 't1', 'u1', 'CONFIRMED', '2026-08-01 10:00:00');
  `);
  memberTypes.forEach((type, i) => {
    const userId = type === "REGISTERED" ? "'u2'" : "NULL";
    db.exec(
      `INSERT INTO entry_members (id, entry_id, member_type, user_id, order_no)
       VALUES ('m${i}', 'e1', '${type}', ${userId}, ${i + 1});`,
    );
  });
}

// JST 日時の文字列を UTC の Date にする。
const jst = (s: string) => new Date(`${s.replace(" ", "T")}+09:00`);

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE tournaments (id TEXT PRIMARY KEY, title TEXT, event_date TEXT, status TEXT);
    CREATE TABLE entries (id TEXT PRIMARY KEY, tournament_id TEXT, user_id TEXT, status TEXT, applied_at TEXT);
    CREATE TABLE entry_members (id TEXT PRIMARY KEY, entry_id TEXT, member_type TEXT, user_id TEXT, order_no INTEGER);
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, tournament_id TEXT, entry_id TEXT,
      dedupe_key TEXT NOT NULL UNIQUE, is_read INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT, created_at TEXT NOT NULL
    );
  `);
  service = new InboxNotificationService(
    new SqliteUnitOfWork(db),
    new SqliteInboxNotificationRepository(db),
  );
});

describe("リマインド（開催7日前 9:00）", () => {
  it("9:00 より前は作成しない", () => {
    seed([]);
    service.syncAll(jst("2026-09-13 08:59:59"));
    expect(service.list("u1", jst("2026-09-13 08:59:59"))).toHaveLength(0);
  });

  it("9:00 以降に1回だけ作成する（再実行しても重複しない）", () => {
    seed([]);
    const now = jst("2026-09-13 09:00:00");
    service.syncAll(now);
    service.syncAll(now);
    service.syncAll(jst("2026-09-14 12:00:00"));
    const list = service.list("u1", jst("2026-09-14 12:00:00"));
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("REMINDER");
    expect(list[0].createdAt).toBe("2026-09-13 09:00:00");
  });

  it("登録ユーザーとして割り当てられたメンバーにも届く", () => {
    seed(["REGISTERED"]);
    const now = jst("2026-09-13 09:00:00");
    expect(service.list("u2", now).map((n) => n.kind)).toEqual(["REMINDER"]);
  });

  it("送信時刻より後に申込したエントリーには作成しない", () => {
    seed([]);
    db.exec("UPDATE entries SET applied_at = '2026-09-15 10:00:00'");
    expect(service.list("u1", jst("2026-09-16 09:00:00"))).toHaveLength(0);
  });

  it("開催日を過ぎた大会には作成しない", () => {
    seed([]);
    expect(service.list("u1", jst("2026-09-21 09:00:00"))).toHaveLength(0);
  });

  it("キャンセル済みエントリー・中止大会には作成しない", () => {
    seed([]);
    db.exec("UPDATE entries SET status = 'CANCELLED'");
    expect(service.list("u1", jst("2026-09-13 09:00:00"))).toHaveLength(0);

    db.exec("UPDATE entries SET status = 'CONFIRMED'; UPDATE tournaments SET status = 'CANCELLED'");
    expect(service.list("u1", jst("2026-09-13 09:00:00"))).toHaveLength(0);
  });
});

describe("メンバー指定通知", () => {
  const now = jst("2026-08-02 10:00:00");

  it("未定枠があると申込者に要対応通知を作る（時刻に依らず即時）", () => {
    seed(["REGISTERED", "PENDING", "PENDING"]);
    const list = service.list("u1", now);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      kind: "MEMBER_PENDING",
      category: "ACTION",
      entryId: "e1",
      resolvedAt: null,
    });
    expect(list[0].body).toContain("2名分");
    expect(service.unreadCount("u1", now)).toBe(1);
  });

  it("ゲスト（未登録ユーザー）枠のみなら通知しない", () => {
    seed(["REGISTERED", "GUEST"]);
    expect(service.list("u1", now)).toHaveLength(0);
  });

  it("未定枠が埋まると解消済みになり、未読件数から外れる", () => {
    seed(["PENDING"]);
    expect(service.unreadCount("u1", now)).toBe(1);

    db.exec("UPDATE entry_members SET member_type = 'REGISTERED', user_id = 'u2'");
    const list = service.list("u1", now);
    expect(list).toHaveLength(1);
    expect(list[0].resolvedAt).not.toBeNull();
    expect(service.unreadCount("u1", now)).toBe(0);
  });

  it("解消後に再び未定になると未対応・未読に戻る", () => {
    seed(["PENDING"]);
    service.list("u1", now);
    db.exec("UPDATE entry_members SET member_type = 'GUEST'");
    service.list("u1", now);
    db.exec("UPDATE entry_members SET member_type = 'PENDING'");
    const list = service.list("u1", now);
    expect(list).toHaveLength(1);
    expect(list[0].resolvedAt).toBeNull();
    expect(list[0].isRead).toBe(false);
  });

  it("エントリーをキャンセルすると解消済みになる", () => {
    seed(["PENDING"]);
    service.list("u1", now);
    db.exec("UPDATE entries SET status = 'CANCELLED'");
    expect(service.list("u1", now)[0].resolvedAt).not.toBeNull();
  });
});

describe("既読", () => {
  it("markRead は本人の通知だけを既読にする", () => {
    seed(["PENDING"]);
    const now = jst("2026-08-02 10:00:00");
    const [n] = service.list("u1", now);

    service.markRead("u2", n.id); // 他人は変更できない
    expect(service.unreadCount("u1", now)).toBe(1);

    service.markRead("u1", n.id);
    expect(service.unreadCount("u1", now)).toBe(0);
  });

  it("markAllRead で全件既読になる", () => {
    seed([]);
    const now = jst("2026-09-13 09:00:00");
    service.list("u1", now);
    expect(service.unreadCount("u1", now)).toBe(1);
    service.markAllRead("u1");
    expect(service.unreadCount("u1", now)).toBe(0);
  });
});
