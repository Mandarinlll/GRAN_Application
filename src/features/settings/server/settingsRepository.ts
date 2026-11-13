// user_settings テーブルへのアクセスを集約するリポジトリ。
import { db, NOW_JST } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ColorMode,
  type FontSize,
} from "@/features/settings/types/settings";

interface SettingsRow {
  notify_reminder: number;
  notify_member_assign: number;
  font_size: FontSize;
  color_mode: ColorMode;
}

// 設定を取得する。行が無ければ既定値を返す。
export function getSettings(userId: string): AppSettings {
  const row = db
    .prepare(
      "SELECT notify_reminder, notify_member_assign, font_size, color_mode FROM user_settings WHERE user_id = ?",
    )
    .get(userId) as SettingsRow | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    notifyReminder: row.notify_reminder === 1,
    notifyMemberAssign: row.notify_member_assign === 1,
    fontSize: row.font_size,
    colorMode: row.color_mode,
  };
}

// 設定を保存する（無ければ作成）。
export function saveSettings(userId: string, s: AppSettings): void {
  db.prepare(
    `INSERT INTO user_settings (
       user_id, notify_reminder, notify_member_assign, font_size, color_mode, updated_at
     ) VALUES (?, ?, ?, ?, ?, ${NOW_JST})
     ON CONFLICT(user_id) DO UPDATE SET
       notify_reminder = excluded.notify_reminder,
       notify_member_assign = excluded.notify_member_assign,
       font_size = excluded.font_size,
       color_mode = excluded.color_mode,
       updated_at = excluded.updated_at`,
  ).run(
    userId,
    s.notifyReminder ? 1 : 0,
    s.notifyMemberAssign ? 1 : 0,
    s.fontSize,
    s.colorMode,
  );
}
