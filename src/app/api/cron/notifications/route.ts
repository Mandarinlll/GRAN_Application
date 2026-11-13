// 通知の定期同期エンドポイント（GET /api/cron/notifications）。
//
// 外部スケジューラ（例: 毎時0分）から呼び出し、全ユーザーのリマインド（開催7日前 9:00 JST）と
// メンバー未定通知を生成する。冪等なので毎時実行しても重複しない。
// 認証: Authorization: Bearer <CRON_SECRET>。CRON_SECRET 未設定時は常に拒否する。

import { timingSafeEqual } from "node:crypto";
import { createInboxNotificationService } from "@/server/container";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  createInboxNotificationService().syncAll();
  return Response.json({ ok: true });
}
