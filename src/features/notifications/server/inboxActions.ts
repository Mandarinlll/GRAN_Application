"use server";

// 通知ページの Server Actions（既読化）。薄いアダプタ: セッション確認 → サービス呼び出し → 再描画。

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createInboxNotificationService } from "@/server/container";

const notificationIdSchema = z.string().min(1);

export interface InboxActionResult {
  ok: boolean;
  message?: string;
}

export async function markNotificationReadAction(
  notificationId: unknown,
): Promise<InboxActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) return { ok: false, message: "入力内容をご確認ください。" };

  createInboxNotificationService().markRead(session.sub, parsed.data);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<InboxActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  createInboxNotificationService().markAllRead(session.sub);
  revalidatePath("/notifications");
  return { ok: true, message: "すべての通知を既読にしました。" };
}
