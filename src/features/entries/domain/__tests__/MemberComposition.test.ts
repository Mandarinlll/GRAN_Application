// MemberComposition（人数レンジ）と CategoryRules（種目ルール）の検証
// （oop-architecture.md §5）。現行 category.ts の既定・内部依存を保存する。

import { describe, expect, it } from "vitest";

import { MemberComposition } from "@/features/entries/domain/MemberComposition";
import { CategoryRules } from "@/features/tournaments/domain/CategoryRules";

describe("CategoryRules", () => {
  it("団体戦系（MEN/WOMEN/MIX_TEAM）は isTeamCategory=true", () => {
    expect(CategoryRules.isTeamCategory("MEN_TEAM")).toBe(true);
    expect(CategoryRules.isTeamCategory("WOMEN_TEAM")).toBe(true);
    expect(CategoryRules.isTeamCategory("MIX_TEAM")).toBe(true);
    expect(CategoryRules.isTeamCategory("SINGLES")).toBe(false);
    expect(CategoryRules.isTeamCategory("DOUBLES")).toBe(false);
  });

  it("requiresLeader = isTeamCategory || DOUBLES", () => {
    expect(CategoryRules.requiresLeader("DOUBLES")).toBe(true);
    expect(CategoryRules.requiresLeader("MEN_TEAM")).toBe(true);
    expect(CategoryRules.requiresLeader("SINGLES")).toBe(false);
  });

  it("requiresTeam = requiresLeader", () => {
    expect(CategoryRules.requiresTeam("DOUBLES")).toBe(true);
    expect(CategoryRules.requiresTeam("WOMEN_TEAM")).toBe(true);
    expect(CategoryRules.requiresTeam("SINGLES")).toBe(false);
  });
});

describe("MemberComposition.countRange", () => {
  it("SINGLES は 1〜1", () => {
    expect(MemberComposition.countRange("SINGLES", null, null)).toEqual({
      min: 1,
      max: 1,
    });
  });

  it("DOUBLES は 2〜2", () => {
    expect(MemberComposition.countRange("DOUBLES", null, null)).toEqual({
      min: 2,
      max: 2,
    });
  });

  it("団体戦は大会指定を優先し、無指定なら 4〜6", () => {
    expect(MemberComposition.countRange("MEN_TEAM", null, null)).toEqual({
      min: 4,
      max: 6,
    });
    expect(MemberComposition.countRange("MEN_TEAM", 5, 8)).toEqual({
      min: 5,
      max: 8,
    });
  });
});

describe("MemberComposition.isValidCount", () => {
  it("レンジ内は true、範囲外は false", () => {
    expect(MemberComposition.isValidCount(2, "DOUBLES", null, null)).toBe(true);
    expect(MemberComposition.isValidCount(1, "DOUBLES", null, null)).toBe(false);
    expect(MemberComposition.isValidCount(3, "DOUBLES", null, null)).toBe(false);
    expect(MemberComposition.isValidCount(4, "MEN_TEAM", null, null)).toBe(true);
    expect(MemberComposition.isValidCount(6, "MEN_TEAM", null, null)).toBe(true);
    expect(MemberComposition.isValidCount(7, "MEN_TEAM", null, null)).toBe(false);
  });
});
