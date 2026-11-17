// トピックスのリポジトリ。SQL はこの層にのみ閉じ込める。
// 追加・更新・削除は管理者画面の設計後に、この層へ関数を足す想定。
import { db, NOW_JST } from "@/lib/db";
import type { Topic } from "@/features/topics/types/topic";

type Row = {
  id: string;
  title: string;
  image_key: string;
  link_url: string | null;
};

// 公開中（フラグON かつ 公開期間内）のトピックスを表示順で返す。
export function listPublishedTopics(): Topic[] {
  const rows = db
    .prepare(
      `SELECT id, title, image_key, link_url FROM topics
        WHERE is_published = 1
          AND (publish_from IS NULL OR publish_from <= ${NOW_JST})
          AND (publish_until IS NULL OR publish_until >= ${NOW_JST})
        ORDER BY sort_order ASC, created_at DESC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    imageSrc: `/api/topics/${r.id}/image`,
    linkUrl: r.link_url,
  }));
}

// 画像の保存キーを返す（公開中でなければ null）。画像配信 API 用。
export function getPublishedTopicImageKey(id: string): string | null {
  const row = db
    .prepare(
      `SELECT image_key FROM topics
        WHERE id = ? AND is_published = 1
          AND (publish_from IS NULL OR publish_from <= ${NOW_JST})
          AND (publish_until IS NULL OR publish_until >= ${NOW_JST})`,
    )
    .get(id) as { image_key: string } | undefined;
  return row?.image_key ?? null;
}
