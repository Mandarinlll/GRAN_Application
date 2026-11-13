import { describe, it, expect } from "vitest";
import {
  isReminderDue,
  reminderDueAt,
  toJstString,
} from "@/features/notifications/utils/schedule";

describe("reminderDueAt", () => {
  it("開催日の7日前 9:00 を返す", () => {
    expect(reminderDueAt("2026-09-20")).toBe("2026-09-13 09:00:00");
  });
  it("月またぎも正しく計算する", () => {
    expect(reminderDueAt("2026-03-03")).toBe("2026-02-24 09:00:00");
  });
});

describe("isReminderDue", () => {
  it("7日前の 8:59 はまだ対象外", () => {
    expect(isReminderDue("2026-09-20", "2026-09-13 08:59:59")).toBe(false);
  });
  it("7日前の 9:00 ちょうどから対象", () => {
    expect(isReminderDue("2026-09-20", "2026-09-13 09:00:00")).toBe(true);
  });
  it("開催当日までは対象", () => {
    expect(isReminderDue("2026-09-20", "2026-09-20 12:00:00")).toBe(true);
  });
  it("開催日を過ぎたら対象外", () => {
    expect(isReminderDue("2026-09-20", "2026-09-21 09:00:00")).toBe(false);
  });
});

describe("toJstString", () => {
  it("UTC を JST（+9h）に変換する", () => {
    expect(toJstString(new Date("2026-09-12T23:30:00Z"))).toBe(
      "2026-09-13 08:30:00",
    );
  });
});
