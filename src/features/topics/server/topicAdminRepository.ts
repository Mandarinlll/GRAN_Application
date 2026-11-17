// トピックス管理（管理画面）用のリポジトリ。SQL はこの層にのみ閉じ込める。
// 削除は論理削除（deleted_at）。公開側クエリは topicRepository 側で deleted_at IS NULL を条件にしている。
import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type { AdminTopic } from "@/features/topics/types/topic";
import type { CreateTopicInput, UpdateTopicInput } from "@/features/topics/types/schema";
import { nowJstString, topicStatus } from "@/features/topics/utils/topicStatus";

type Row = {
  id: string;
  title: string;
  image_key: string;
  link_url: string | null;
  sort_order: number;
  is_published: number;
  publish_from: string | null;
  publish_until: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, title, image_key, link_url, sort_order, is_published, publish_from, publish_until, created_at, updated_at";

function toAdminTopic(r: Row, now: string): AdminTopic {
  const isPublished = r.is_published === 1;
  return {
    id: r.id,
    title: r.title,
    imageSrc: `/api/admin/topics/${r.id}/image?v=${encodeURIComponent(r.image_key)}`,
    linkUrl: r.link_url,
    sortOrder: r.sort_order,
    isPublished,
    publishFrom: r.publish_from,
    publishUntil: r.publish_until,
    status: topicStatus(
      { isPublished, publishFrom: r.publish_from, publishUntil: r.publish_until },
      now,
    ),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// 削除済みを除く全トピックスを表示順で返す。
export function listAllTopics(): AdminTopic[] {
  const now = nowJstString();
  const rows = db
    .prepare(
      `SELECT ${COLUMNS} FROM topics WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, created_at DESC`,
    )
    .all() as Row[];
  return rows.map((r) => toAdminTopic(r, now));
}

export function getTopicById(id: string): AdminTopic | null {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM topics WHERE id = ? AND deleted_at IS NULL`)
    .get(id) as Row | undefined;
  return row ? toAdminTopic(row, nowJstString()) : null;
}

// 管理者用の画像キー取得（公開状態に関係なく、削除済みは除く）。
export function getTopicImageKey(id: string): string | null {
  const row = db
    .prepare("SELECT image_key FROM topics WHERE id = ? AND deleted_at IS NULL")
    .get(id) as { image_key: string } | undefined;
  return row?.image_key ?? null;
}

// 新規作成。表示順は末尾に追加する。
export function createTopic(input: CreateTopicInput, imageKey: string): string {
  const id = randomUUID();
  const max = db
    .prepare("SELECT MAX(sort_order) AS m FROM topics WHERE deleted_at IS NULL")
    .get() as { m: number | null };
  db.prepare(
    `INSERT INTO topics (id, title, image_key, link_url, sort_order, is_published,
       publish_from, publish_until, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
  ).run(
    id,
    input.title,
    imageKey,
    input.linkUrl,
    (max.m ?? -1) + 1,
    input.isPublished ? 1 : 0,
    input.publishFrom,
    input.publishUntil,
  );
  return id;
}

// 更新。指定されたフィールドのみ反映し、画像を差し替えた場合は旧キーを返す。
// 対象が無い（または削除済み）なら null。
export function updateTopic(
  id: string,
  input: UpdateTopicInput,
  newImageKey?: string,
): { oldImageKey: string } | null {
  const current = db
    .prepare("SELECT image_key, publish_from, publish_until FROM topics WHERE id = ? AND deleted_at IS NULL")
    .get(id) as { image_key: string; publish_from: string | null; publish_until: string | null } | undefined;
  if (!current) return null;

  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  const add = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    values.push(v);
  };
  if (input.title !== undefined) add("title", input.title);
  if (input.linkUrl !== undefined) add("link_url", input.linkUrl);
  if (input.publishFrom !== undefined) add("publish_from", input.publishFrom);
  if (input.publishUntil !== undefined) add("publish_until", input.publishUntil);
  if (input.isPublished !== undefined) add("is_published", input.isPublished ? 1 : 0);
  if (newImageKey) add("image_key", newImageKey);

  db.prepare(
    `UPDATE topics SET ${sets.length ? sets.join(", ") + "," : ""} updated_at = ${NOW_JST}
      WHERE id = ? AND deleted_at IS NULL`,
  ).run(...values, id);
  return { oldImageKey: current.image_key };
}

// 論理削除。画像キーを返す（呼び出し側が画像ファイルを消す）。対象が無ければ null。
export function softDeleteTopic(id: string): { imageKey: string } | null {
  const row = db
    .prepare("SELECT image_key FROM topics WHERE id = ? AND deleted_at IS NULL")
    .get(id) as { image_key: string } | undefined;
  if (!row) return null;
  db.prepare(
    `UPDATE topics SET deleted_at = ${NOW_JST}, is_published = 0, updated_at = ${NOW_JST} WHERE id = ?`,
  ).run(id);
  return { imageKey: row.image_key };
}

// 表示順の更新。ids の並びどおりに sort_order を 0.. で振り直す。
// 有効なトピックスの全件を重複なく指定する必要がある（不一致なら false）。
export function reorderTopics(ids: string[]): boolean {
  const active = db
    .prepare("SELECT id FROM topics WHERE deleted_at IS NULL")
    .all() as Array<{ id: string }>;
  const activeIds = new Set(active.map((r) => r.id));
  if (ids.length !== activeIds.size || new Set(ids).size !== ids.length) return false;
  if (!ids.every((id) => activeIds.has(id))) return false;

  const stmt = db.prepare(`UPDATE topics SET sort_order = ?, updated_at = ${NOW_JST} WHERE id = ?`);
  db.exec("BEGIN");
  try {
    ids.forEach((id, i) => stmt.run(i, id));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return true;
}
