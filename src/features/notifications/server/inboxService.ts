// アプリ内通知の生成・同期ロジック。
//
// 常駐のバッチ/cron が無い構成のため、通知は「画面表示時の遅延生成」で作る。
// 発火予定時刻を過ぎていれば生成し、created_at には発火予定時刻を入れる
// （リマインドは「開催7日前の 9:00」に届いた扱いで表示される）。
// dedupe_key の UNIQUE 制約により、何度呼んでも二重に作られない（冪等）。
//
// 通知種別:
//  - REMINDER_7DAYS: 確定エントリーの大会の7日前 9:00。申込者と登録ユーザーのメンバー宛て。
//  - MEMBER_ASSIGN : 未定枠（PENDING）が残っている確定エントリーの申込者宛て。
//                    ゲスト枠（未登録ユーザー）は未定枠ではないため対象外。
//                    未定枠が解消されると自動で「対応済み」になる。
import {
  countUnread,
  createNotificationIfAbsent,
  listOpenMemberAssignNotifications,
  listUpcomingConfirmedEntries,
  reopenNotification,
  resolveNotification,
} from "@/features/notifications/server/inboxRepository";
import {
  isReminderDue,
  reminderDueAt,
  toJstString,
} from "@/features/notifications/utils/schedule";
import { formatEventDate } from "@/utils/date";
import { getSettings } from "@/features/settings/server/settingsRepository";

// 画面表示時に呼ぶ: 指定ユーザー宛ての通知を最新状態に同期する。
export function syncNotificationsForUser(
  userId: string,
  now: Date = new Date(),
): void {
  const nowJst = toJstString(now);
  const today = nowJst.slice(0, 10);

  // ユーザーの通知設定（OFFの種別は新規生成しない。既存の通知はそのまま残る）。
  const settings = getSettings(userId);
  const entries = listUpcomingConfirmedEntries(today, "9999-12-31");

  for (const e of entries) {
    // 1) 7日前 9:00 のリマインド（申込者 + 登録ユーザーのメンバー）。
    const recipients = new Set([e.ownerUserId, ...e.registeredMemberIds]);
    if (
      settings.notifyReminder &&
      recipients.has(userId) &&
      isReminderDue(e.eventDate, nowJst)
    ) {
      createNotificationIfAbsent({
        userId,
        kind: "REMINDER_7DAYS",
        tournamentId: e.tournamentId,
        entryId: e.entryId,
        title: "【リマインド】開催まで7日です",
        body: `${formatEventDate(e.eventDate)} ${e.startTime.slice(0, 5)} 開催の【${e.tournamentTitle}】（${e.venue}）まであと1週間です。開催情報をご確認ください。`,
        dedupeKey: `REMINDER_7DAYS:${e.entryId}:${userId}`,
        createdAt: reminderDueAt(e.eventDate),
      });
    }

    // 2) 未定枠が残っている団体戦等: 申込者へメンバー指定を促す。
    if (
      settings.notifyMemberAssign &&
      e.ownerUserId === userId &&
      e.pendingCount > 0
    ) {
      const key = `MEMBER_ASSIGN:${e.entryId}`;
      const created = createNotificationIfAbsent({
        userId,
        kind: "MEMBER_ASSIGN",
        tournamentId: e.tournamentId,
        entryId: e.entryId,
        title: "【要対応】出場メンバーが未定です",
        body: `${formatEventDate(e.eventDate)} 開催の【${e.tournamentTitle}】に未定枠が${e.pendingCount}名分あります。出場メンバーを指定してください。`,
        dedupeKey: key,
      });
      // 一度解消した後に未定枠が再発生した場合は要対応へ戻す。
      if (!created) reopenNotification(key);
    }
  }

  // 3) 未定枠が解消された（またはエントリーが無効になった）通知を対応済みにする。
  for (const n of listOpenMemberAssignNotifications(userId)) {
    if (!n.entryActive || n.pendingCount === 0) {
      resolveNotification(n.dedupeKey);
    }
  }
}

// 同期した上で未読件数を返す（ナビのバッジ表示用）。
export function getUnreadCountSynced(userId: string): number {
  syncNotificationsForUser(userId);
  return countUnread(userId);
}
