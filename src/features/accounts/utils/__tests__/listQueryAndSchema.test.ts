import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PAGE_SIZE, pageRange, parseTeamListQuery, parseUserListQuery } from "../listQuery";
import { parseCreateUserInput } from "../../types/userSchema";

const NOW = new Date("2025-06-15T00:00:00Z"); // JST 2025-06-15 09:00

const valid = {
  email: " Foo@Example.com ",
  realName: "山田 太郎",
  kanaName: "ヤマダ タロウ",
  nickname: "taro",
  phoneNumber: "090-1234-5678",
  declaredClass: "B",
};

describe("parseUserListQuery / parseTeamListQuery", () => {
  /** **Validates: Requirements 2.4, 2.10** */
  it("accepts 1-100 char search terms and rejects 101+", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (n) => {
        const r = parseUserListQuery({ q: "a".repeat(n) });
        expect(r.ok && r.query.q).toBe("a".repeat(n));
      }),
    );
    expect(parseUserListQuery({ q: "a".repeat(101) }).ok).toBe(false);
    expect(parseTeamListQuery({ q: "a".repeat(101) }).ok).toBe(false);
    const empty = parseUserListQuery({ q: "   " });
    expect(empty.ok && empty.query.q).toBeUndefined();
  });

  /** **Validates: Requirements 2.3** */
  it("ignores invalid enums and normalizes page", () => {
    const r = parseUserListQuery({ role: "X", status: "ACTIVE", declaredClass: "ZZ", page: "-3", locked: "1" });
    expect(r.ok && r.query).toMatchObject({ role: undefined, status: "ACTIVE", declaredClass: undefined, page: 1, lockedOnly: true });
  });
});

describe("pageRange", () => {
  /** **Validates: Requirements 2.3** */
  it("computes display range", () => {
    expect(PAGE_SIZE).toBe(50);
    expect(pageRange(120, 2)).toEqual({ from: 51, to: 100, pages: 3 });
    expect(pageRange(120, 3)).toEqual({ from: 101, to: 120, pages: 3 });
    expect(pageRange(0, 1)).toEqual({ from: 0, to: 0, pages: 1 });
  });
});

describe("parseCreateUserInput", () => {
  /** **Validates: Requirements 4.7, 4.10** */
  it("normalizes valid input with defaults", () => {
    const r = parseCreateUserInput(valid, NOW);
    expect(r).toMatchObject({ ok: true, data: { email: "foo@example.com", role: "USER", gender: null, birthDate: null, granLevel: null } });
  });

  /** **Validates: Requirements 4.9, 4.17** */
  it("collects all field errors simultaneously", () => {
    const r = parseCreateUserInput({ email: "", realName: " ", kanaName: "", nickname: "", phoneNumber: "", declaredClass: "" }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors).sort()).toEqual(["declaredClass", "email", "kanaName", "nickname", "phoneNumber", "realName"]);
    }
  });

  /** **Validates: Requirements 4.10, 4.12, 4.13, 4.14, 4.15, 4.16, 4.19** */
  it("rejects invalid values per field", () => {
    const r = parseCreateUserInput(
      {
        ...valid,
        email: "bad",
        realName: "あ".repeat(41),
        phoneNumber: "090abc",
        declaredClass: "Z",
        granLevel: "99",
        role: "BOSS",
        gender: "X",
        birthDate: "2025-02-30",
      },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors).sort()).toEqual(
        ["birthDate", "declaredClass", "email", "gender", "granLevel", "phoneNumber", "realName", "role"],
      );
    }
  });

  /** **Validates: Requirements 4.19** */
  it("rejects future birth dates but accepts today", () => {
    expect(parseCreateUserInput({ ...valid, birthDate: "2025-06-16" }, NOW).ok).toBe(false);
    expect(parseCreateUserInput({ ...valid, birthDate: "2025-06-15" }, NOW).ok).toBe(true);
    expect(parseCreateUserInput({ ...valid, birthDate: "2024-02-29" }, NOW).ok).toBe(true);
  });

  /** **Validates: Requirements 4.15** */
  it("accepts Gran_Level 100-999 integers only", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 1100 }), (n) => {
        const r = parseCreateUserInput({ ...valid, granLevel: n }, NOW);
        expect(r.ok).toBe(n >= 100 && n <= 999);
      }),
    );
    expect(parseCreateUserInput({ ...valid, granLevel: "" }, NOW).ok).toBe(true);
    expect(parseCreateUserInput({ ...valid, granLevel: 500.5 }, NOW).ok).toBe(false);
  });

  /** **Validates: Requirements 4.13** */
  it("validates phone numbers", () => {
    expect(parseCreateUserInput({ ...valid, phoneNumber: "123456789" }, NOW).ok).toBe(false);
    expect(parseCreateUserInput({ ...valid, phoneNumber: "1234567890123456" }, NOW).ok).toBe(false);
    expect(parseCreateUserInput({ ...valid, phoneNumber: "03-1234-5678" }, NOW).ok).toBe(true);
  });

  it("handles non-object input", () => {
    expect(parseCreateUserInput(null, NOW).ok).toBe(false);
  });
});
