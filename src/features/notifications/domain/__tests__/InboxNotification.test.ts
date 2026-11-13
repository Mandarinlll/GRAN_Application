import { describe, expect, it } from "vitest";
import {
  buildMemberPending,
  buildReminder,
  reminderFireAt,
  toJstString,
} from "@/features/notifications/domain/InboxNotification";

describe("reminderFireAt", () => {
  it("開催日の7日前 9:00 を返す", () => {
    expect(reminderFireAt("2026-09-20")).toBe("2026-09-13 09:00:00");
  });

  it("月またぎ・年またぎを正しく計算する", () => {
    expect(reminderFireAt("2026-10-04")).toBe("2026-09-27 09:00:00");
    expect(reminderFireAt("2027-01-03")).toBe("2026-12-27 09:00:00");
  });
});

describe("toJstString", () => {
  it("UTC の Date を JST の文字列にする", () => {
    expect(toJstString(new Date("2026-09-13T00:00:00Z"))).toBe(
      "2026-09-13 09:00:00",
    );
    // UTC 15:00 は JST では翌日 0:00
    expect(toJstString(new Date("2026-09-12T15:00:00Z"))).toBe(
      "2026-09-13 00:00:00",
    );
  });
});

describe("通知メッセージの生成", () => {
  it("リマインドは送信時刻を作成日時にし、エントリー×ユーザーで重複排除キーを持つ", () => {
    const n = buildReminder({
      userId: "u1",
      entryId: "e1",
      tournamentId: "t1",
      tournamentTitle: "秋季大会",
      eventDate: "2026-09-20",
      appliedAt: "2026-08-01 10:00:00",
    });
    expect(n.kind).toBe("REMINDER");
    expect(n.category).toBe("ENTRY");
    expect(n.createdAt).toBe("2026-09-13 09:00:00");
    expect(n.dedupeKey).toBe("REMINDER:e1:u1");
    expect(n.body).toContain("09/20 秋季大会");
  });

  it("メンバー未定は要対応カテゴリで、未定人数を本文に含む", () => {
    const n = buildMemberPending({
      userId: "u1",
      entryId: "e1",
      tournamentId: "t1",
      tournamentTitle: "秋季大会",
      eventDate: "2026-09-20",
      appliedAt: "2026-08-01 10:00:00",
      pendingCount: 2,
    });
    expect(n.kind).toBe("MEMBER_PENDING");
    expect(n.category).toBe("ACTION");
    expect(n.dedupeKey).toBe("MEMBER_PENDING:e1");
    expect(n.body).toContain("2名分");
  });
});
