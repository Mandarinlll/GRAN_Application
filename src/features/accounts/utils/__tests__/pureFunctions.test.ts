import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateInitialPassword } from "../initialPassword";
import { buildLogDetail, MAX_DETAIL_LENGTH } from "../logDetail";
import { displayOrUnset, formatDisplayRange } from "../format";

describe("generateInitialPassword", () => {
  /** **Validates: Requirements 4.3, 6.8** */
  it("14 chars alphanumeric with a letter and a digit; unique across runs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const p = generateInitialPassword();
      expect(p).toMatch(/^[A-Za-z0-9]{14}$/);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/[0-9]/);
      seen.add(p);
    }
    expect(seen.size).toBe(500);
  });
});

describe("buildLogDetail", () => {
  /** **Validates: Requirements 14.6** */
  it("serializes plain fields", () => {
    expect(buildLogDetail({ from: "USER", to: "ADMIN", n: 1, ok: true, x: null })).toBe(
      '{"from":"USER","to":"ADMIN","n":1,"ok":true,"x":null}',
    );
  });

  it("rejects secret-like keys", () => {
    for (const k of ["password", "passwordHash", "password_hash", "initialPassword", "sessionToken", "refresh_token"]) {
      expect(() => buildLogDetail({ [k]: "x" })).toThrow();
    }
  });

  it("throws when over 2000 chars, accepts exactly 2000", () => {
    const overhead = JSON.stringify({ a: "" }).length;
    expect(buildLogDetail({ a: "x".repeat(MAX_DETAIL_LENGTH - overhead) }).length).toBe(MAX_DETAIL_LENGTH);
    expect(() => buildLogDetail({ a: "x".repeat(MAX_DETAIL_LENGTH - overhead + 1) })).toThrow();
  });

  it("property: result is valid JSON within the limit or throws", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.constantFrom("a", "b", "role", "reason"), fc.string({ maxLength: 1500 })), (d) => {
        try {
          const s = buildLogDetail(d);
          expect(s.length).toBeLessThanOrEqual(MAX_DETAIL_LENGTH);
          expect(JSON.parse(s)).toEqual(d);
        } catch (e) {
          expect(JSON.stringify(d).length).toBeGreaterThan(MAX_DETAIL_LENGTH);
        }
      }),
    );
  });
});

describe("format", () => {
  /** **Validates: Requirements 3.1** */
  it("displayOrUnset never returns an empty string", () => {
    expect(displayOrUnset(null)).toBe("未設定");
    expect(displayOrUnset(undefined)).toBe("未設定");
    expect(displayOrUnset("")).toBe("未設定");
    expect(displayOrUnset("  ")).toBe("未設定");
    expect(displayOrUnset(0)).toBe("0");
    expect(displayOrUnset("abc")).toBe("abc");
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: null }), (v) => displayOrUnset(v).length > 0),
    );
  });

  it("formatDisplayRange", () => {
    expect(formatDisplayRange(51, 100)).toBe("51–100 件目");
    expect(formatDisplayRange(0, 0)).toBe("0 件");
  });
});
