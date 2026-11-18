// 通知管理 API: 送信履歴・宛先候補の取得（GET）と、お知らせ/緊急連絡の送信（POST, JSON）。
// notifications.manage 権限（ADMIN / OPERATOR）のみ。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import {
  countRecipients,
  createAnnouncement,
  listAnnouncements,
  listTournamentOptions,
  tournamentExists,
} from "@/features/notifications/server/announcementRepository";
import { createAnnouncementSchema } from "@/features/notifications/types/announcementSchema";

export const GET = withAdminApi("notifications.manage", () =>
  NextResponse.json({
    ok: true,
    announcements: listAnnouncements(),
    tournaments: listTournamentOptions(),
  }),
);

export const POST = withAdminApi("notifications.manage", async (req, _ctx, admin) => {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "リクエストが不正です。" }, { status: 400 });
  }
  const parsed = createAnnouncementSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { ok: false, message: "入力内容をご確認ください。", fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.audience === "TOURNAMENT" && !tournamentExists(input.tournamentId ?? "")) {
    return NextResponse.json(
      { ok: false, message: "対象の大会が見つかりません。", fieldErrors: { tournamentId: "対象の大会が見つかりません" } },
      { status: 400 },
    );
  }
  if (countRecipients(input.audience, input.tournamentId) === 0) {
    return NextResponse.json({ ok: false, message: "配信対象のユーザーがいません。" }, { status: 400 });
  }
  const result = createAnnouncement(input, admin.userId);
  revalidatePath("/notifications");
  revalidatePath("/admin/notifications");
  return NextResponse.json({ ok: true, ...result }, { status: 201 });
});