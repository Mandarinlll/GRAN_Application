// 通知の発火タイミング計算（純粋関数）。
// 日時は DB と同じく JST の文字列 "YYYY-MM-DD HH:MM:SS" で扱い、
// 文字列比較で前後関係を判定できる形に揃える。

// リマインドは開催日の何日前か。
export const REMINDER_DAYS_BEFORE = 7;
// リマインドの送信時刻（JST）。
export const REMINDER_HOUR = "09:00:00";

// Date を JST の "YYYY-MM-DD HH:MM:SS" へ（実行環境のタイムゾーンに依存しない）。
export function toJstString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 19).replace("T", " ");
}

// 開催日 "YYYY-MM-DD" の7日前 9:00（JST）を返す。
export function reminderDueAt(eventDate: string): string {
  const [y, m, d] = eventDate.replace(/\//g, "-").split("-").map(Number);
  const base = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() - REMINDER_DAYS_BEFORE);
  return `${base.toISOString().slice(0, 10)} ${REMINDER_HOUR}`;
}

// リマインド対象か: 送信時刻を過ぎていて、かつ開催日を過ぎていない。
export function isReminderDue(eventDate: string, nowJst: string): boolean {
  const today = nowJst.slice(0, 10);
  return nowJst >= reminderDueAt(eventDate) && eventDate.replace(/\//g, "-") >= today;
}
