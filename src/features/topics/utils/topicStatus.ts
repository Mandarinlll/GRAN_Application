// トピックスの公開状態判定（純粋関数）。
// 日時は DB と同じ JST の "YYYY-MM-DD HH:MM:SS" 文字列で、辞書順比較が時刻順と一致する。

import type { TopicStatus } from "@/features/topics/types/topic";

export function topicStatus(
  t: { isPublished: boolean; publishFrom: string | null; publishUntil: string | null },
  nowJst: string,
): TopicStatus {
  if (!t.isPublished) return "UNPUBLISHED";
  if (t.publishFrom && t.publishFrom > nowJst) return "SCHEDULED";
  if (t.publishUntil && t.publishUntil < nowJst) return "EXPIRED";
  return "PUBLISHED";
}

// 現在時刻を JST の "YYYY-MM-DD HH:MM:SS" で返す（DB の NOW_JST と同じ形式）。
export function nowJstString(date: Date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  PUBLISHED: "公開中",
  UNPUBLISHED: "非公開",
  SCHEDULED: "公開前",
  EXPIRED: "期間外",
};
