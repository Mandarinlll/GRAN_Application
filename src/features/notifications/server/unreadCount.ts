// ナビゲーションの未読バッジ用に、ログイン中ユーザーの未読通知件数を返す。
// "use server" ではない（クライアントから直接呼べる Server Action にしない）。
// 未ログインなら 0。呼び出し時に通知を最新化するため、バッジも常に最新になる。

import { getSession } from "@/lib/session";
import { createInboxNotificationService } from "@/server/container";

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  return createInboxNotificationService().unreadCount(session.sub);
}
