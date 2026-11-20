// トピックス管理（管理画面）用のリポジトリ。SQL はこの層にのみ閉じ込める。
// 削除は論理削除（deleted_at）。公開側クエリは topicRepository 側で deleted_at IS NULL を条件にしている。
import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import { MAX_TOPIC_IMAGES, type AdminTopic, type TopicImage } from "@/features/topics/types/topic";
import type { CreateTopicInput, UpdateTopicInput } from "@/features/topics/types/schema";
import { nowJstString, topicStatus } from "@/features/topics/utils/topicStatus";

type Row = {
  id: string;
  title: string;
  image_key: string;
  body: string | null;
  link_url: string | null;
  sort_order: number;
  is_published: number;
  publish_from: string | null;
  publish_until: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, title, image_key, body, link_url, sort_order, is_published, publish_from, publish_until, created_at, updated_at";

// トピックスの画像（表示順）。管理者用プレビューURLを付ける。
function listImages(topicId: string): TopicImage[] {
  const rows = db
    .prepare("SELECT id, image_key FROM topic_images WHERE topic_id = ? ORDER BY sort_order ASC")
    .all(topicId) as Array<{ id: string; image_key: string }>;
  return rows.map((i) => ({
    id: i.id,
    src: `/api/admin/topics/${topicId}/images/${i.id}?v=${encodeURIComponent(i.image_key)}`,
  }));
}

function toAdminTopic(r: Row, now: string): AdminTopic {
  const isPublished = r.is_published === 1;
  return {
    id: r.id,
    title: r.title,
    imageSrc: `/api/admin/topics/${r.id}/image?v=${encodeURIComponent(r.image_key)}`,
    linkUrl: r.link_url,
    body: r.body,
    images: listImages(r.id),
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

// 管理者用の画像キー取得（公開状態に関係なく、削除済みは除く）。imageId 省略時はカバー画像。
export function getTopicImageKey(id: string, imageId?: string): string | null {
  const row = db
    .prepare(
      `SELECT i.image_key FROM topic_images i JOIN topics t ON t.id = i.topic_id
        WHERE t.id = ? AND t.deleted_at IS NULL ${imageId ? "AND i.id = ?" : ""}
        ORDER BY i.sort_order ASC LIMIT 1`,
    )
    .get(...(imageId ? [id, imageId] : [id])) as { image_key: string } | undefined;
  return row?.image_key ?? null;
}

// 画像行を末尾に追加する。呼び出し側のトランザクション内で使う。
function insertImages(topicId: string, keys: string[], startOrder: number) {
  const stmt = db.prepare(
    `INSERT INTO topic_images (id, topic_id, image_key, sort_order, created_at) VALUES (?, ?, ?, ?, ${NOW_JST})`,
  );
  keys.forEach((key, i) => stmt.run(randomUUID(), topicId, key, startOrder + i));
}

// topics.image_key をカバー画像（先頭）のキーに揃える。
function syncCoverKey(topicId: string) {
  db.prepare(
    `UPDATE topics SET image_key = (SELECT image_key FROM topic_images WHERE topic_id = ? ORDER BY sort_order ASC LIMIT 1)
      WHERE id = ?`,
  ).run(topicId, topicId);
}

function inTransaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// 新規作成。表示順は末尾に追加する。imageKeys は 1〜MAX_TOPIC_IMAGES 件（呼び出し側で検証済みであること）。
export function createTopic(input: CreateTopicInput, imageKeys: string[]): string {
  const id = randomUUID();
  inTransaction(() => {
    const max = db
      .prepare("SELECT MAX(sort_order) AS m FROM topics WHERE deleted_at IS NULL")
      .get() as { m: number | null };
    db.prepare(
      `INSERT INTO topics (id, title, body, image_key, link_url, sort_order, is_published,
         publish_from, publish_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      id,
      input.title,
      input.body,
      imageKeys[0],
      input.linkUrl,
      (max.m ?? -1) + 1,
      input.isPublished ? 1 : 0,
      input.publishFrom,
      input.publishUntil,
    );
    insertImages(id, imageKeys, 0);
  });
  return id;
}

// 画像の変更内容。
export type ImageChanges = {
  addKeys: string[]; // 末尾に追加する新規画像
  removeIds: string[]; // 削除する既存画像ID
  order?: string[]; // 既存画像IDの並び（省略・未指定分は現在の順で後ろへ）
  replaceCoverKey?: string; // カバー画像（先頭）の差し替え（旧 `file` 互換）
};

export type UpdateResult =
  | { ok: true; deleteKeys: string[] } // 保存後に消すべき画像キー
  | { ok: false; reason: "NOT_FOUND" | "NO_IMAGE" | "TOO_MANY_IMAGES" };

// 更新。指定されたフィールドのみ反映する。画像は removeIds → order → replaceCover → addKeys の順に適用する。
export function updateTopic(id: string, input: UpdateTopicInput, changes: ImageChanges): UpdateResult {
  return inTransaction<UpdateResult>(() => {
    const exists = db
      .prepare("SELECT 1 AS x FROM topics WHERE id = ? AND deleted_at IS NULL")
      .get(id);
    if (!exists) return { ok: false, reason: "NOT_FOUND" };

    const current = db
      .prepare("SELECT id, image_key FROM topic_images WHERE topic_id = ? ORDER BY sort_order ASC")
      .all(id) as Array<{ id: string; image_key: string }>;
    const removeSet = new Set(changes.removeIds);
    const deleteKeys: string[] = current.filter((c) => removeSet.has(c.id)).map((c) => c.image_key);
    let kept = current.filter((c) => !removeSet.has(c.id));
    if (changes.order) {
      const rank = new Map(changes.order.map((x, i) => [x, i]));
      kept = [...kept].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    }
    if (changes.replaceCoverKey && kept.length > 0) {
      deleteKeys.push(kept[0].image_key);
      kept[0] = { id: kept[0].id, image_key: changes.replaceCoverKey };
    }
    const total = kept.length + changes.addKeys.length + (changes.replaceCoverKey && kept.length === 0 ? 1 : 0);
    if (total < 1) return { ok: false, reason: "NO_IMAGE" };
    if (total > MAX_TOPIC_IMAGES) return { ok: false, reason: "TOO_MANY_IMAGES" };

    // 画像行を作り直さず、残す行の並びと（差し替えた）キーを反映する。
    if (removeSet.size > 0) {
      const del = db.prepare("DELETE FROM topic_images WHERE id = ? AND topic_id = ?");
      removeSet.forEach((rid) => del.run(rid, id));
    }
    const upd = db.prepare("UPDATE topic_images SET sort_order = ?, image_key = ? WHERE id = ?");
    kept.forEach((k, i) => upd.run(i, k.image_key, k.id));
    let addKeys = changes.addKeys;
    if (changes.replaceCoverKey && kept.length === 0) addKeys = [changes.replaceCoverKey, ...addKeys];
    insertImages(id, addKeys, kept.length);
    syncCoverKey(id);

    const sets: string[] = [];
    const values: Array<string | number | null> = [];
    const add = (col: string, v: string | number | null) => {
      sets.push(`${col} = ?`);
      values.push(v);
    };
    if (input.title !== undefined) add("title", input.title);
    if (input.body !== undefined) add("body", input.body);
    if (input.linkUrl !== undefined) add("link_url", input.linkUrl);
    if (input.publishFrom !== undefined) add("publish_from", input.publishFrom);
    if (input.publishUntil !== undefined) add("publish_until", input.publishUntil);
    if (input.isPublished !== undefined) add("is_published", input.isPublished ? 1 : 0);
    db.prepare(
      `UPDATE topics SET ${sets.length ? sets.join(", ") + "," : ""} updated_at = ${NOW_JST}
        WHERE id = ? AND deleted_at IS NULL`,
    ).run(...values, id);
    return { ok: true, deleteKeys };
  });
}

// 論理削除。画像キー一覧を返す（呼び出し側が画像ファイルを消す）。対象が無ければ null。
export function softDeleteTopic(id: string): { imageKeys: string[] } | null {
  return inTransaction(() => {
    const row = db.prepare("SELECT id FROM topics WHERE id = ? AND deleted_at IS NULL").get(id);
    if (!row) return null;
    const keys = (
      db.prepare("SELECT image_key FROM topic_images WHERE topic_id = ?").all(id) as Array<{ image_key: string }>
    ).map((k) => k.image_key);
    db.prepare("DELETE FROM topic_images WHERE topic_id = ?").run(id);
    db.prepare(
      `UPDATE topics SET deleted_at = ${NOW_JST}, is_published = 0, updated_at = ${NOW_JST} WHERE id = ?`,
    ).run(id);
    return { imageKeys: keys };
  });
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
