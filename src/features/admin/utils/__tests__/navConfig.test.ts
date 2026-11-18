// 管理ナビ: users-teams 項目の有効化と ADMIN のみ表示を検証する。
// Validates: Requirements 1.2, 1.3

import { describe, it, expect } from "vitest";

import { ADMIN_NAV_ITEMS, allowedAdminNavIds } from "@/features/admin/utils/navConfig";

describe("admin navConfig users-teams", () => {
  it("users-teams は /admin/users へ有効化されている", () => {
    const item = ADMIN_NAV_ITEMS.find((i) => i.id === "users-teams");
    expect(item?.href).toBe("/admin/users");
    expect(item?.implemented).toBe(true);
  });

  it("ADMIN にのみ表示され、OPERATOR には表示されない", () => {
    expect(allowedAdminNavIds("ADMIN")).toContain("users-teams");
    expect(allowedAdminNavIds("OPERATOR")).not.toContain("users-teams");
  });
});
