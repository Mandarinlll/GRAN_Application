// 運営からのお知らせ（作成・配信・履歴・受信箱への展開）のユニットテスト（インメモリDB）。
import { describe, it, expect } from "vitest";
import { createUser } from "@/features/auth/server/userRepository";
import { db } from "@/lib/db";
import {
  countRecipients,
  createAnnouncement,
  listAnnouncements,
} from "@/features/notifications/server/announcementRepository";
import { listNotifications } from "@/features/notifications/server/inboxRepository";
import { createAnnouncementSchema } from "@/features/notifications/types/announcementSchema";
import { needsAction } from "@/features/notifications/utils/display";

let seq = 0;
function user() {
  seq += 1;
  return createUser({
    email: `announce-test-${seq}@example.com`,
    passwordHash: "x",
    realName: `通知${seq}`,
    kanaName: "ツウチ",
    nickname: `ann${seq}`,
    gender: "MALE",
    birthDate: "1990-01-01",
    phoneNumber: null,
    declaredClass: "C",
    granLevel: 500,
  });
}

describe("createAnnouncementSchema", () => {
  it("大会宛てで大会未選択ならエラー", () => {
    const r = createAnnouncementSchema.safeParse({ title: "a", body: "b", audience: "TOURNAMENT" });
    expect(r.success).toBe(false);
  });
  it("空白のみのタイトルは不可、isUrgent は既定で false", () => {
    expect(createAnnouncementSchema.safeParse({ title: "  ", body: "b", audience: "ALL" }).success).toBe(false);
    const ok = createAnnouncementSchema.parse({ title: "a", body: "b", audience: "ALL" });
    expect(ok.isUrgent).toBe(false);
  });
});

describe("createAnnouncement", () => {
  it("全ユーザーの受信箱へ対応不要の通知として配信し、履歴に残す", () => {
    const u = user();
    const admin = user();
    const total = countRecipients("ALL");
    const r = createAnnouncement({ title: "案内", body: "本文", isUrgent: false, audience: "ALL" }, admin.id);
    expect(r.recipientCount).toBe(total);
    const n = listNotifications(u.id).find((x) => x.kind === "ANNOUNCEMENT");
    expect(n?.title).toBe("案内");
    expect(n && needsAction(n)).toBe(false);
    expect(listAnnouncements()[0]).toMatchObject({ id: r.id, isUrgent: false, tournamentId: null });
  });

  it("緊急連絡は URGENT で配信され、配信ログにも記録される", () => {
    const u = user();
    const before = (db.prepare("SELECT COUNT(*) AS c FROM notification_logs WHERE delivery_type = 'URGENT_BROADCAST'").get() as { c: number }).c;
    const r = createAnnouncement({ title: "中止", body: "雨天", isUrgent: true, audience: "ALL" }, u.id);
    expect(listNotifications(u.id).some((x) => x.kind === "URGENT")).toBe(true);
    const after = (db.prepare("SELECT COUNT(*) AS c FROM notification_logs WHERE delivery_type = 'URGENT_BROADCAST'").get() as { c: number }).c;
    expect(after - before).toBe(r.recipientCount);
  });
});