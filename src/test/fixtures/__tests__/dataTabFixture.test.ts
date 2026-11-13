// データタブ用フィクスチャ自体の整合性テスト。
// 投入データが壊れていると、他の単体テストや画面の動作確認の前提が崩れるため確認する。

import { describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db";
import {
  FIXTURE_MATCHES,
  FIXTURE_RESULTS,
  FIXTURE_TOURNAMENT_LIST,
  FIXTURE_USER_LIST,
  seedDataTabFixture,
} from "../dataTabFixture";

const count = (db: ReturnType<typeof openDatabase>, table: string): number =>
  Number((db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c);

describe("dataTabFixture", () => {
  it("テストアカウントは10件で、login_id とメールが重複しない", () => {
    expect(FIXTURE_USER_LIST).toHaveLength(10);
    expect(new Set(FIXTURE_USER_LIST.map((u) => u.loginId)).size).toBe(10);
    expect(new Set(FIXTURE_USER_LIST.map((u) => u.email)).size).toBe(10);
  });

  it("GRANレベルは定義域（100〜999）内で、全8階級＋査定前を網羅する", () => {
    for (const u of FIXTURE_USER_LIST) {
      expect(u.granLevel).toBeGreaterThanOrEqual(100);
      expect(u.granLevel).toBeLessThanOrEqual(999);
    }
    expect(FIXTURE_USER_LIST.some((u) => !u.calibrated)).toBe(true);
  });

  it("大会の開催日はすべて過去日（出場履歴の対象になる）", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const t of FIXTURE_TOURNAMENT_LIST) {
      expect(t.eventDate <= today).toBe(true);
    }
  });

  it("GRANレベル履歴はユーザーごとに連続し、最新の変動後が現在レベルと一致する", () => {
    for (const u of FIXTURE_USER_LIST) {
      const rows = FIXTURE_RESULTS.filter((r) => r.userId === u.id);
      if (rows.length === 0) continue;
      for (const r of rows) expect(r.post).toBe(r.pre + r.diff);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].pre).toBe(rows[i - 1].post);
        expect(rows[i].recordedAt > rows[i - 1].recordedAt).toBe(true);
      }
      expect(rows[rows.length - 1].post).toBe(u.granLevel);
    }
  });

  it("試合の勝者は対戦した2エントリーのどちらか（引き分け・不戦を除く）", () => {
    for (const m of FIXTURE_MATCHES) {
      if (m.winner == null) continue;
      expect([m.entry1.id, m.entry2?.id ?? m.entry1.id]).toContain(m.winner.id);
    }
  });

  it("インメモリDBへ投入でき、2回目はスキップされる（冪等）", () => {
    const db = openDatabase(":memory:");
    const first = seedDataTabFixture(db, { passwordHash: "dummy-hash" });
    expect(first.skipped).toBe(false);
    expect(count(db, "users")).toBe(10);
    expect(count(db, "tournaments")).toBe(first.tournaments);
    expect(count(db, "tournament_matches")).toBe(first.matches);
    expect(count(db, "tournament_results")).toBe(first.results);

    const second = seedDataTabFixture(db, { passwordHash: "dummy-hash" });
    expect(second.skipped).toBe(true);
    expect(count(db, "users")).toBe(10);
    db.close();
  });

  it("openDatabase(':memory:') は呼ぶたびに独立したDBを返す", () => {
    const a = openDatabase(":memory:");
    const b = openDatabase(":memory:");
    seedDataTabFixture(a, { passwordHash: "dummy-hash" });
    expect(count(a, "users")).toBe(10);
    expect(count(b, "users")).toBe(0);
    a.close();
    b.close();
  });
});