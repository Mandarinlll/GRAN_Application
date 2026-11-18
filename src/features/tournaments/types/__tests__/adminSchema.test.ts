import { describe, expect, it } from "vitest";
import {
  adminBulkSchema,
  adminCreateSchema,
  adminTournamentSchema,
  adminUpdateSchema,
  flattenAdminIssues,
} from "@/features/tournaments/types/adminSchema";

const valid = {
  title: "  春季大会 ",
  eventDate: "2030-04-10",
  category: "MEN_TEAM",
  tier: "B",
  venue: "中央コート",
  capacity: "32",
  entryFee: 3000,
  startTime: "09:00",
  entryStartAt: "2030-03-01T10:00",
  entryEndAt: "2030-04-01T23:59",
  prize: "   ",
};

describe("adminTournamentSchema", () => {
  it("正規化し、団体戦の genderDivision を補完する", () => {
    const r = adminTournamentSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.title).toBe("春季大会");
    expect(r.data.capacity).toBe(32);
    expect(r.data.entryStartAt).toBe("2030-03-01 10:00:00");
    expect(r.data.prize).toBeNull();
    expect(r.data.endTime).toBeNull();
    expect(r.data.genderDivision).toBe("MEN");
  });

  it("全項目のエラーを同時に返す（列挙エラーと併存してもクロス検証が動く）", () => {
    const r = adminTournamentSchema.safeParse({
      ...valid,
      title: "",
      tier: "Z",
      capacity: 0,
      endTime: "08:00",
      entryEndAt: "2030-04-11 00:00",
      teamSizeMin: 5,
      teamSizeMax: 3,
      alertThreshold: 50,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const f = flattenAdminIssues(r.error);
    expect(Object.keys(f).sort()).toEqual(
      ["alertThreshold", "capacity", "endTime", "entryEndAt", "teamSizeMax", "tier", "title"].sort(),
    );
  });

  it("alertThreshold は定員以下", () => {
    const r = adminTournamentSchema.safeParse({ ...valid, alertThreshold: 33 });
    expect(r.success).toBe(false);
  });

  it("更新用は expectedUpdatedAt 必須、登録用は copyFromId 任意", () => {
    expect(adminUpdateSchema.safeParse(valid).success).toBe(false);
    expect(adminUpdateSchema.safeParse({ ...valid, expectedUpdatedAt: "2030-01-01 00:00:00" }).success).toBe(true);
    expect(adminCreateSchema.safeParse(valid).success).toBe(true);
  });
});

describe("adminBulkSchema", () => {
  const { eventDate: _e, category: _c, ...common } = valid;
  void _e;
  void _c;

  it("1〜50 件の行を展開する", () => {
    const r = adminBulkSchema.safeParse({
      common,
      rows: [
        { eventDate: "2030-04-10", category: "SINGLES" },
        { eventDate: "2030-04-11", category: "MIX_TEAM", title: "別名" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data[1].title).toBe("別名");
  });

  it("0 件・51 件は拒否し、行のエラーは行番号つきで返す", () => {
    expect(adminBulkSchema.safeParse({ common, rows: [] }).success).toBe(false);
    const many = Array.from({ length: 51 }, () => ({ eventDate: "2030-04-10", category: "SINGLES" }));
    expect(adminBulkSchema.safeParse({ common, rows: many }).success).toBe(false);
    const r = adminBulkSchema.safeParse({ common, rows: [{ eventDate: "2030-02-30", category: "SINGLES" }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(flattenAdminIssues(r.error)["rows.0.eventDate"]).toBeTruthy();
  });
});
