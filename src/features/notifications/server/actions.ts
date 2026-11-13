"use server";
// 通知ページの Server Actions（既読化）。
// セッション検証を冒頭で行い、更新は本人の通知のみに限定する。
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  markAllRead,
  markRead,
} from "@/features/notifications/server/inboxRepository";

const idSchema = z.string().min(1).max(100);

export async function markNotificationReadAction(
  notificationId: unknown,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const parsed = idSchema.safeParse(notificationId);
  if (!parsed.success) return { ok: false };
  markRead(session.sub, parsed.data);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean;
}> {
  const session = await getSession();
  if (!session) return { ok: false };
  markAllRead(session.sub);
  revalidatePath("/notifications");
  return { ok: true };
}
