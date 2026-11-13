// データタブ用リポジトリの単体テスト。
// テストごとにインメモリDBを作り、テストアカウント10件のフィクスチャを投入して検証する。
// （開発用の data/gran.db には触れない）

import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db";
import {
  FIXTURE_TOURNAMENTS as T,
  FIXTURE_USERS as U,
  seedDataTabFixture,
} from "@/test/fixtures/dataTabFixture";
import { createDataRepository, type DataRepository } from "../dataRepository";
import { ApiError } from "../handlers";
import { aggregateByDimension, UNREGISTERED_SERIES_KEY } from "../../utils/aggregate";

let db: DatabaseSync;
let repo: DataRepository;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDataTabFixture(db, { passwordHash: "dummy-hash" });
  repo = createDataRepository(db);
});

afterEach(() => {
  db.close();
});

describe("マイデータ: 階級と昇格ポイント", () => {
  it("C級520は、次のBC級（550）まで30ポイント・進捗70%", () => {
    const level = repo.getLevel(U.taro.id);
    expect(level).toMatchObject({ granLevel: 520, isCalibrated: true, tier: "C" });
    expect(level.next).toMatchObject({ tier: "BC", threshold: 550, pointsToGo: 30 });
    expect(level.next?.progressPercent).toBeCloseTo(70);
  });

  it("A級は最上位のため次の階級が無い", () => {
    expect(repo.getLevel(U.aClass.id)).toMatchObject({ tier: "A", next: null });
  });

  it("査定前ユーザーは isCalibrated=false", () => {
    expect(repo.getLevel(U.uncalibrated.id).isCalibrated).toBe(false);
  });

  it("存在しないユーザーは NOT_FOUND", () => {
    expect(() => repo.getLevel("no-such-user")).toThrow(ApiError);
  });
});

describe("マイデータ: GRANレベル履歴", () => {
  it("新しい順に並び、変動前・変動後が連続している", () => {
    const page = repo.getGranHistory(U.taro.id, 0, 20);
    expect(page.total).toBe(7);
    expect(page.nextOffset).toBeNull();
    expect(page.rows[0]).toMatchObject({ preLevel: 512, diff: 8, postLevel: 520 });
    for (let i = 1; i < page.rows.length; i++) {
      expect(page.rows[i - 1].recordedAt >= page.rows[i].recordedAt).toBe(true);
      expect(page.rows[i - 1].preLevel).toBe(page.rows[i].postLevel);
    }
  });

  it("グラフ用データは全件を古い順で返し、最後が現在レベル", () => {
    const chart = repo.getGranHistory(U.taro.id, 0, 3).chart ?? [];
    expect(chart).toHaveLength(7);
    expect(chart[0].postLevel).toBe(511);
    expect(chart[chart.length - 1].postLevel).toBe(520);
  });

  it("ページングで「もっと見る」の続きを取得できる", () => {
    const first = repo.getGranHistory(U.taro.id, 0, 5);
    expect(first.rows).toHaveLength(5);
    expect(first.nextOffset).toBe(5);
    const second = repo.getGranHistory(U.taro.id, 5, 5);
    expect(second.rows).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
    expect(second.chart).toBeUndefined();
  });

  it("履歴が無いユーザーは0件", () => {
    expect(repo.getGranHistory(U.dClass.id, 0, 20).total).toBe(0);
  });
});

describe("マイデータ: 通算勝敗と直近試合", () => {
  it("不戦・引き分け・未消化を除いて 9勝5敗（14試合）", () => {
    expect(repo.getRecord(U.taro.id)).toMatchObject({ total: 14, wins: 9, losses: 5 });
  });

  it("直近5試合を開催日の新しい順に返す", () => {
    const { recent } = repo.getRecord(U.taro.id);
    expect(recent).toHaveLength(5);
    expect(recent[0]).toMatchObject({ tournamentTitle: T.t09.title, result: "WIN", score: "6-1" });
    expect(recent[1]).toMatchObject({ tournamentTitle: T.t08.title, opponent: "テストチームスマッシュ" });
    // ゲストは氏名ではなく「ゲスト」と表示する
    expect(recent[2]).toMatchObject({ result: "LOSS", opponent: "テストA級・ゲスト" });
  });

  it("試合が無いユーザーは0件", () => {
    expect(repo.getRecord(U.uncalibrated.id)).toMatchObject({ total: 0, wins: 0, losses: 0, recent: [] });
  });
});

describe("マイデータ: 条件別の勝率", () => {
  it("種目は男子・女子・混合の3区分のみ（未設定区分は出ない）", () => {
    const buckets = aggregateByDimension(repo.getDecidedMatches(U.taro.id), "category");
    expect(buckets.map((b) => b.key)).toEqual(["MEN", "WOMEN", "MIXED"]);
    expect(buckets.find((b) => b.key === "MEN")).toMatchObject({ matches: 10, wins: 6, losses: 4 });
    expect(buckets.find((b) => b.key === "WOMEN")).toMatchObject({ matches: 0 });
    expect(buckets.find((b) => b.key === "MIXED")).toMatchObject({ matches: 4, wins: 3, losses: 1 });
  });

  it("サーフェス未登録の試合はサーフェス別集計から除外され、大会シリーズ未登録は「未設定」区分に入る", () => {
    const matches = repo.getDecidedMatches(U.taro.id);
    const surfaceBuckets = aggregateByDimension(matches, "surface");
    const seriesUnset = aggregateByDimension(matches, "series").find((b) => b.key === UNREGISTERED_SERIES_KEY);
    expect(surfaceBuckets.find((b) => b.key === "UNSET")).toBeUndefined();
    expect(surfaceBuckets.reduce((s, b) => s + b.matches, 0)).toBe(matches.length - 2);
    expect(seriesUnset?.matches).toBe(1);
    expect(aggregateByDimension(matches.map((m) => ({ ...m, surface: null })), "surface")).toEqual([]);
  });

  it("季節別の試合数の合計は通算試合数と一致する", () => {
    const buckets = aggregateByDimension(repo.getDecidedMatches(U.taro.id), "season");
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((s, b) => s + b.matches, 0)).toBe(14);
  });

  it("対戦相手（団体戦）はチーム名ごとに集計し、個人戦は含めない", () => {
    const buckets = aggregateByDimension(repo.getDecidedMatches(U.taro.id), "opponent");
    expect(buckets.find((b) => b.key === "テストチームスマッシュ")).toMatchObject({ matches: 3, wins: 2, losses: 1 });
    expect(buckets.find((b) => b.key === "テストミックス")).toMatchObject({ matches: 1, wins: 1 });
  });
});

describe("出場データ", () => {
  it("キャンセル済み・キャンセル待ち・不参加の大会は出場履歴に出ない", () => {
    const page = repo.listParticipations(U.taro.id);
    const ids = page.rows.map((r) => r.tournamentId);
    expect(page.total).toBe(8);
    expect(ids).not.toContain(T.t07.id);
    expect(ids).not.toContain(T.t10.id);
    expect(ids).not.toContain(T.t11.id);
    expect(page.years).toEqual([2026, 2025]);
  });

  it("既定は開催日の新しい順、asc で古い順", () => {
    expect(repo.listParticipations(U.taro.id).rows[0].tournamentId).toBe(T.t09.id);
    expect(repo.listParticipations(U.taro.id, { order: "asc" }).rows[0].tournamentId).toBe(T.t01.id);
  });

  it("結果未確定の大会は result が null", () => {
    const row = repo.listParticipations(U.taro.id).rows.find((r) => r.tournamentId === T.t09.id);
    expect(row?.result).toBeNull();
  });

  it("詳細: 試合とGRANレベル変動を返し、ゲスト氏名は出さない", () => {
    const detail = repo.getParticipationDetail(U.taro.id, T.t02.id);
    expect(detail.isResultConfirmed).toBe(true);
    expect(detail.granChange).toEqual({ pre: 511, diff: -6, post: 505 });
    expect(detail.matches.map((m) => m.outcome)).toEqual(["WIN", "DRAW", "LOSS"]);
    expect(JSON.stringify(detail)).not.toContain("山田ゲスト太郎");
  });

  it("詳細: 結果未確定の大会は isResultConfirmed=false で、未消化の試合は UNDECIDED", () => {
    const detail = repo.getParticipationDetail(U.taro.id, T.t09.id);
    expect(detail.isResultConfirmed).toBe(false);
    expect(detail.granChange).toBeNull();
    expect(detail.matches.map((m) => m.outcome)).toEqual(["WIN", "UNDECIDED"]);
  });

  it("詳細: 出場していない大会は NOT_FOUND", () => {
    expect(() => repo.getParticipationDetail(U.taro.id, T.t07.id)).toThrow(ApiError);
    expect(() => repo.getParticipationDetail(U.taro.id, T.t10.id)).toThrow(ApiError);
  });
});

describe("ランキング", () => {
  it("階級別: C級は同値を消化試合数で並べ、査定前ユーザーを除外する", () => {
    const page = repo.getTierRanking(U.taro.id, "C", 0, 50);
    expect(page.rows.map((r) => r.nickname)).toEqual(["テスト太郎", "テスト同値"]);
    expect(page.rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(page.me).toEqual({ rank: 1, total: 2 });
    expect(page.rows[0].isMe).toBe(true);
  });

  it("階級別: 自分がいない階級では me が null", () => {
    const page = repo.getTierRanking(U.taro.id, "A", 0, 50);
    expect(page.rows.map((r) => r.nickname)).toEqual(["テストA級"]);
    expect(page.me).toBeNull();
  });

  it("種目別: 男子は男性のみで、同値は同順位（1,2,3,3,5）", () => {
    const page = repo.getCategoryRanking(U.taro.id, "MEN", 0, 50);
    expect(page.rows.map((r) => r.rank)).toEqual([1, 2, 3, 3, 5]);
    expect(page.me).toEqual({ rank: 3, total: 5 });
  });

  it("種目別: 女子は査定前を除く女性3名、混合は査定済み全員9名", () => {
    expect(repo.getCategoryRanking(U.taro.id, "WOMEN", 0, 50).total).toBe(3);
    expect(repo.getCategoryRanking(U.taro.id, "MIXED", 0, 50).total).toBe(9);
  });

  it("ランキングには実名・メールアドレス・ユーザーIDを含めない", () => {
    const json = JSON.stringify(repo.getCategoryRanking(U.taro.id, "MIXED", 0, 50));
    expect(json).not.toContain("試験 ");
    expect(json).not.toContain("@example.test");
    expect(json).not.toContain("dt-user-");
  });
});