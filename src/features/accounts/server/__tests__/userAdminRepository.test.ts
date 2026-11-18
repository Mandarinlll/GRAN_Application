import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import {
  listUsers, insertUser, getUserDetail, deleteUserCascade, hasHistoryReferences, nextAdminLoginId,
} from "../userAdminRepository";

const base = {
  email: "A@Example.com", realName: "山田", kanaName: "ヤマダ", nickname: "yama",
  gender: null, birthDate: null, phoneNumber: "0312345678", declaredClass: "A" as const,
  granLevel: null, role: "USER" as const,
};

describe("userAdminRepository", () => {
  it("採番・一覧・詳細・削除", () => {
    expect(nextAdminLoginId()).toBe("000101");
    const r = insertUser(base, "hash");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.loginId).toBe("000101");
    expect(insertUser(base, "hash")).toEqual({ ok: false, reason: "EMAIL_TAKEN" });
    const list = listUsers({ q: "100%_", lockedOnly: false, uncalibratedOnly: false, page: 1 });
    expect(list.total).toBe(0);
    const l2 = listUsers({ q: "yama", lockedOnly: false, uncalibratedOnly: true, page: 9 });
    expect(l2.rows[0]).toMatchObject({ granLevel: 924, isLevelCalibrated: false, locked: false });
    expect(JSON.stringify(l2)).not.toContain("hash");
    expect(getUserDetail(r.id)?.activePersonalEntryCount).toBe(0);
    expect(hasHistoryReferences(r.id)).toBe(false);
    deleteUserCascade(r.id);
    expect(getUserDetail(r.id)).toBeNull();
    void db;
  });
});
