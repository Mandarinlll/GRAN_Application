import { describe, expect, it } from "vitest";
import {
  evaluateAdminAccess,
  resolveAdminRole,
  roleHasPermission,
} from "@/features/admin/utils/permissions";
import type { User } from "@/types/user";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "u1",
    loginId: "000001",
    email: "a@example.com",
    role: "USER",
    isAdmin: false,
    status: "ACTIVE",
    isInitialLogin: false,
    realName: "テスト 太郎",
    kanaName: "テスト タロウ",
    nickname: "t",
    avatarUrl: null,
    gender: null,
    birthDate: null,
    phoneNumber: null,
    declaredClass: null,
    granLevel: 500,
    isLevelCalibrated: true,
    ratedMatchCount: 0,
    lastLoginAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("resolveAdminRole", () => {
  it("ADMIN / OPERATOR を採用する", () => {
    expect(resolveAdminRole(makeUser({ role: "ADMIN" }))).toBe("ADMIN");
    expect(resolveAdminRole(makeUser({ role: "OPERATOR" }))).toBe("OPERATOR");
  });

  it("一般ユーザー・代表者は null", () => {
    expect(resolveAdminRole(makeUser({ role: "USER" }))).toBeNull();
    expect(resolveAdminRole(makeUser({ role: "LEADER" }))).toBeNull();
  });

  it("is_admin = true なら入場可（ADMIN 扱い）", () => {
    expect(resolveAdminRole(makeUser({ role: "USER", isAdmin: true }))).toBe("ADMIN");
  });

  it("OPERATOR は is_admin が立っていても OPERATOR のまま", () => {
    expect(resolveAdminRole(makeUser({ role: "OPERATOR", isAdmin: true }))).toBe("OPERATOR");
  });

  it("ACTIVE 以外は管理者でも不可", () => {
    expect(resolveAdminRole(makeUser({ role: "ADMIN", status: "SUSPENDED" }))).toBeNull();
    expect(resolveAdminRole(makeUser({ role: "ADMIN", status: "PROVISIONAL" }))).toBeNull();
  });
});

describe("ADMIN と OPERATOR の権限差", () => {
  it("OPERATOR はスコア入力・エントリー確認のみ", () => {
    expect(roleHasPermission("OPERATOR", "scores.input")).toBe(true);
    expect(roleHasPermission("OPERATOR", "entries.view")).toBe(true);
    expect(roleHasPermission("OPERATOR", "accounts.manage")).toBe(false);
    expect(roleHasPermission("OPERATOR", "tournaments.manage")).toBe(false);
    expect(roleHasPermission("OPERATOR", "roles.manage")).toBe(false);
  });

  it("ADMIN は全権限を持つ", () => {
    for (const p of [
      "console.access",
      "entries.view",
      "scores.input",
      "tournaments.manage",
      "accounts.manage",
      "roles.manage",
    ] as const) {
      expect(roleHasPermission("ADMIN", p)).toBe(true);
    }
  });
});

describe("evaluateAdminAccess", () => {
  it("ユーザーが存在しなければ UNAUTHENTICATED", () => {
    expect(evaluateAdminAccess(null)).toEqual({ ok: false, reason: "UNAUTHENTICATED" });
  });

  it("一般ユーザーは FORBIDDEN", () => {
    expect(evaluateAdminAccess(makeUser())).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("OPERATOR は入場できるが ADMIN 専用操作は FORBIDDEN", () => {
    const op = makeUser({ role: "OPERATOR" });
    expect(evaluateAdminAccess(op).ok).toBe(true);
    expect(evaluateAdminAccess(op, "accounts.manage")).toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("ADMIN は ADMIN 専用操作も許可", () => {
    const result = evaluateAdminAccess(makeUser({ role: "ADMIN" }), "roles.manage");
    expect(result).toEqual({
      ok: true,
      admin: { userId: "u1", loginId: "000001", role: "ADMIN" },
    });
  });
});
