// トピックスのリポジトリ（ユーザー向け・公開分のみ）。SQL はこの層にのみ閉じ込める。
// 追加・更新・削除は topicAdminRepository 側。
import { db, NOW_JST } from "@/lib/db";
import type { Topic, TopicDetail } from "@/features/topics/types/topic";

type Row = {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  image_count: number;
};

// 公開中（フラグON・公開期間内・未削除）の条件。
const PUBLISHED = `is_published = 1 AND deleted_at IS NULL
  AND (publish_from IS NULL OR publish_from <= ${NOW_JST})
  AND (publish_until IS NULL OR publish_until >= ${NOW_JST})`;

// 公開中のトピックスを表示順で返す。
export function listPublishedTopics(): Topic[] {
  const rows = db
    .prepare(
      `SELECT id, title, body, link_url,
              (SELECT COUNT(*) FROM topic_images i WHERE i.topic_id = topics.id) AS image_count
         FROM topics
        WHERE ${PUBLISHED}
        ORDER BY sort_order ASC, created_at DESC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    imageSrc: `/api/topics/${r.id}/image`,
    imageCount: r.image_count,
    body: r.body,
    linkUrl: r.link_url,
  }));
}

// 詳細画面用。公開中でなければ null。
export function getPublishedTopicDetail(id: string): TopicDetail | null {
  const row = db
    .prepare(`SELECT id, title, body, link_url FROM topics WHERE id = ? AND ${PUBLISHED}`)
    .get(id) as Omit<Row, "image_count"> | undefined;
  if (!row) return null;
  const images = db
    .prepare("SELECT id FROM topic_images WHERE topic_id = ? ORDER BY sort_order ASC")
    .all(id) as Array<{ id: string }>;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    images: images.map((i) => ({ id: i.id, src: `/api/topics/${row.id}/images/${i.id}` })),
    linkUrl: row.link_url,
  };
}

// カバー画像（先頭）の保存キーを返す（公開中でなければ null）。互換用 `/api/topics/{id}/image`。
export function getPublishedTopicImageKey(id: string): string | null {
  const row = db
    .prepare(
      `SELECT i.image_key FROM topic_images i JOIN topics ON topics.id = i.topic_id
        WHERE topics.id = ? AND ${PUBLISHED.replaceAll(/\b(is_published|deleted_at|publish_from|publish_until)\b/g, "topics.$1")}
        ORDER BY i.sort_order ASC LIMIT 1`,
    )
    .get(id) as { image_key: string } | undefined;
  return row?.image_key ?? null;
}

// 指定画像の保存キーを返す（公開中のトピックスの画像でなければ null）。
export function getPublishedTopicImageKeyById(id: string, imageId: string): string | null {
  const row = db
    .prepare(
      `SELECT i.image_key FROM topic_images i JOIN topics ON topics.id = i.topic_id
        WHERE topics.id = ? AND i.id = ?
          AND ${PUBLISHED.replaceAll(/\b(is_published|deleted_at|publish_from|publish_until)\b/g, "topics.$1")}`,
    )
    .get(id, imageId) as { image_key: string } | undefined;
  return row?.image_key ?? null;
}
