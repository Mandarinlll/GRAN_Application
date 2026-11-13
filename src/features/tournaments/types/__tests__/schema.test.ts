import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  TOURNAMENT_CATEGORIES,
  tournamentCreateSchema,
  validateTournamentUpdate,
} from "@/features/tournaments/types/schema";

const INDIVIDUAL = ["SINGLES", "DOUBLES"] as const;
const TEAM = ["MEN_TEAM", "WOMEN_TEAM", "MIX_TEAM"] as const;
const DIVISIONS = ["MEN", "WOMEN", "MIXED"] as const;

describe("tournamentCreateSchema", () => {
  it.each(INDIVIDUAL)("%s で genderDivision 未指定・null は拒否する", (category) => {
    expect(tournamentCreateSchema.safeParse({ category, surface: "HARD" }).success).toBe(false);
    const r = tournamentCreateSchema.safeParse({ category, genderDivision: null, surface: "HARD" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["genderDivision"]);
  });

  it.each(TEAM)("%s は genderDivision 未指定でも受け付ける", (category) => {
    expect(tournamentCreateSchema.safeParse({ category, surface: "HARD" }).success).toBe(true);
  });

  it("不正な genderDivision は拒否する", () => {
    expect(
      tournamentCreateSchema.safeParse({ category: "SINGLES", genderDivision: "UNSET", surface: "HARD" }).success,
    ).toBe(false);
  });

  it("category × genderDivision の全組み合わせで、個人戦かつ未指定のときだけ拒否する", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOURNAMENT_CATEGORIES),
        fc.option(fc.constantFrom(...DIVISIONS), { nil: undefined }),
        (category, genderDivision) => {
          const ok = tournamentCreateSchema.safeParse({ category, genderDivision, surface: "HARD" }).success;
          const isIndividual = category === "SINGLES" || category === "DOUBLES";
          expect(ok).toBe(!(isIndividual && genderDivision === undefined));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("validateTournamentUpdate", () => {
  it("既存の個人戦で genderDivision を null に変更する更新は拒否する", () => {
    const r = validateTournamentUpdate(
      { genderDivision: null },
      { category: "SINGLES", genderDivision: "MEN", surface: "HARD" },
    );
    expect(r.success).toBe(false);
  });

  it("団体戦から DOUBLES へ変更する際、既存値を引き継げば受け付け、null 指定なら拒否する", () => {
    const r = validateTournamentUpdate(
      { category: "DOUBLES" },
      { category: "MEN_TEAM", genderDivision: "MEN", surface: "HARD" },
    );
    // 既存値 MEN が引き継がれるため受け付ける
    expect(r.success).toBe(true);
    const r2 = validateTournamentUpdate(
      { category: "DOUBLES", genderDivision: null },
      { category: "MEN_TEAM", genderDivision: "MEN", surface: "HARD" },
    );
    expect(r2.success).toBe(false);
  });

  it("genderDivision を変更しない更新は既存値で検証する", () => {
    expect(
      validateTournamentUpdate({ title: "x" }, { category: "SINGLES", genderDivision: "WOMEN", surface: "HARD" })
        .success,
    ).toBe(true);
    expect(
      validateTournamentUpdate({ title: "x" }, { category: "SINGLES", genderDivision: null, surface: "HARD" })
        .success,
    ).toBe(false);
  });
});

