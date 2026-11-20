import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SessionPayload, User } from "@/types/user";

// 本文（任意）と複数画像のテスト。モックの方針は topicsApi.test.ts と同じ。
const getSessionMock = vi.fn<() => Promise<SessionPayload | null>>();
const findUserByIdMock = vi.fn<(id: string) => User | null>();
vi.mock("@/lib/session", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/features/auth/server/userRepository", () => ({
  findUserById: (id: string) => findUserByIdMock(id),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const files = new Map<string, Uint8Array>();
let keySeq = 0;
vi.mock("@/features/teams/server/imageStorage", () => ({
  imageStorage: {
    save: async (prefix: string, bytes: Uint8Array, ext: string) => {
      const key = `${prefix}-${++keySeq}.${ext}`;
      files.set(key, bytes);
      return key;
    },
    read: async (key: string) => files.get(key) ?? null,
    delete: async (key: string) => {
      files.delete(key);
    },
  },
}));

import { db } from "@/lib/db";
import * as listRoute from "@/app/api/admin/topics/route";
import * as itemRoute from "@/app/api/admin/topics/[id]/route";
import * as adminImageRoute from "@/app/api/admin/topics/[id]/images/[imageId]/route";
import * as publicDetailRoute from "@/app/api/topics/[id]/route";
import * as publicImageRoute from "@/app/api/topics/[id]/images/[imageId]/route";
import * as publicCoverRoute from "@/app/api/topics/[id]/image/route";
import { getPublishedTopicDetail, listPublishedTopics } from "@/features/topics/server/topicRepository";
import { MAX_TOPIC_BODY_LENGTH, MAX_TOPIC_IMAGES, topicHasDetail } from "@/features/topics/types/topic";

function makeUser(role: User["role"]): User {
  return {
    id: `u-${role}`,
    loginId: "000001",
    email: "a@example.com",
    role,
    isAdmin: false,
    status: "ACTIVE",
    isInitialLogin: false,
    realName: "テスト",
    kanaName: "テスト",
    nickname: "t",
    avatarUrl: null,
    gender: null,
    birthDate: null,
    phoneNumber: null,
    declaredClass: null,
    granLevel: 500,
    isLevelCalibrated: true,
    ratedMatchCount: 0,
    lastLoginAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

function loginAs(role: User["role"]) {
  const u = makeUser(role);
  getSessionMock.mockResolvedValue({ sub: u.id, loginId: u.loginId, role, isAdmin: false });
  findUserByIdMock.mockReturnValue(u);
}

async function png(width = 400, height = 300): Promise<File> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buf)], "a.png", { type: "image/png" });
}

async function pngs(n: number): Promise<File[]> {
  return Promise.all(Array.from({ length: n }, () => png()));
}

function form(fields: Record<string, string>, images: File[] = [], extra: Array<[string, string]> = []): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  images.forEach((f) => fd.append("files", f));
  extra.forEach(([k, v]) => fd.append(k, v));
  return fd;
}

const req = (method: string, body?: BodyInit) => new Request("http://x/api/admin/topics", { method, body });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const imgCtx = (id: string, imageId: string) => ({ params: Promise.resolve({ id, imageId }) });

type Created = { id: string; body: string | null; images: Array<{ id: string; src: string }> };

async function create(fields: Record<string, string>, images: File[]): Promise<Created> {
  const res = await listRoute.POST(req("POST", form(fields, images)), undefined);
  expect(res.status).toBe(201);
  return (await res.json()).topic as Created;
}

const imageIds = (id: string) =>
  (
    db.prepare("SELECT id FROM topic_images WHERE topic_id = ? ORDER BY sort_order").all(id) as Array<{ id: string }>
  ).map((r) => r.id);

beforeEach(() => {
  db.exec("DELETE FROM topics");
  files.clear();
  getSessionMock.mockReset();
  findUserByIdMock.mockReset();
  loginAs("ADMIN");
});

describe("本文（任意）", () => {
  it("本文なしでも作成でき、本文ありなら保存される（改行は LF に揃う）", async () => {
    const none = await create({ title: "本文なし" }, await pngs(1));
    expect(none.body).toBeNull();
    const withBody = await create({ title: "本文あり", body: "1行目\r\n2行目" }, await pngs(1));
    expect(withBody.body).toBe("1行目\n2行目");
  });

  it("空白のみは本文なし、上限超過は 400、HTML はそのまま文字列として保存される", async () => {
    expect((await create({ title: "a", body: "  \n " }, await pngs(1))).body).toBeNull();
    const tooLong = await listRoute.POST(
      req("POST", form({ title: "b", body: "あ".repeat(MAX_TOPIC_BODY_LENGTH + 1) }, await pngs(1))),
      undefined,
    );
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).fieldErrors.body).toBeTruthy();
    const html = await create({ title: "c", body: "<script>alert(1)</script>" }, await pngs(1));
    expect(html.body).toBe("<script>alert(1)</script>");
  });

  it("更新で本文を変更・削除できる（未送信なら変更しない）", async () => {
    const t = await create({ title: "x", body: "元" }, await pngs(1));
    await itemRoute.PATCH(req("PATCH", form({ isPublished: "true" })), ctx(t.id));
    expect(getPublishedTopicDetail(t.id)?.body).toBe("元");
    await itemRoute.PATCH(req("PATCH", form({ body: "新" })), ctx(t.id));
    expect(getPublishedTopicDetail(t.id)?.body).toBe("新");
    await itemRoute.PATCH(req("PATCH", form({ body: "" })), ctx(t.id));
    expect(getPublishedTopicDetail(t.id)?.body).toBeNull();
  });
});

describe("複数画像", () => {
  it("複数枚で作成でき、先頭がカバー画像、枚数上限は 10 枚", async () => {
    const t = await create({ title: "複数" }, await pngs(3));
    expect(t.images).toHaveLength(3);
    expect(files.size).toBe(3);
    const cover = db.prepare("SELECT image_key FROM topics WHERE id = ?").get(t.id) as { image_key: string };
    const first = db.prepare("SELECT image_key FROM topic_images WHERE id = ?").get(t.images[0].id) as {
      image_key: string;
    };
    expect(cover.image_key).toBe(first.image_key);

    files.clear();
    const over = await listRoute.POST(req("POST", form({ title: "多すぎ" }, await pngs(MAX_TOPIC_IMAGES + 1))), undefined);
    expect(over.status).toBe(400);
    expect(files.size).toBe(0);
    expect((await create({ title: "ちょうど上限" }, await pngs(MAX_TOPIC_IMAGES))).images).toHaveLength(MAX_TOPIC_IMAGES);
  });

  it("1 枚でも不正な画像があれば全体が失敗し、保存済みの画像も残らない", async () => {
    files.clear();
    const bad = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])], "bad.png");
    const res = await listRoute.POST(req("POST", form({ title: "x" }, [await png(), bad])), undefined);
    expect(res.status).toBe(415);
    expect(files.size).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM topics").get()).toEqual({ c: 0 });
  });

  it("更新: 追加・削除・並び替えができ、削除した画像のファイルは消える", async () => {
    const t = await create({ title: "x" }, await pngs(3));
    const [a, b, c] = t.images.map((i) => i.id);

    // b を削除し、c を先頭へ、新規 1 枚を末尾に追加する。
    const res = await itemRoute.PATCH(
      req("PATCH", form({}, await pngs(1), [["removeImageIds", b], ["imageOrder", c], ["imageOrder", a]])),
      ctx(t.id),
    );
    expect(res.status).toBe(200);
    const ids = imageIds(t.id);
    expect(ids).toHaveLength(3);
    expect(ids.slice(0, 2)).toEqual([c, a]);
    expect(files.size).toBe(3);

    // カバー（topics.image_key）は新しい先頭に追従する。
    const cover = db.prepare("SELECT image_key FROM topics WHERE id = ?").get(t.id) as { image_key: string };
    const first = db.prepare("SELECT image_key FROM topic_images WHERE id = ?").get(c) as { image_key: string };
    expect(cover.image_key).toBe(first.image_key);
  });

  it("更新: 全画像を削除する・11 枚目を追加する場合は 400 で何も変わらない", async () => {
    const t = await create({ title: "x" }, await pngs(2));
    const before = imageIds(t.id);
    const removeAll = await itemRoute.PATCH(
      req("PATCH", form({}, [], before.map((id) => ["removeImageIds", id] as [string, string]))),
      ctx(t.id),
    );
    expect(removeAll.status).toBe(400);
    expect(imageIds(t.id)).toEqual(before);

    const full = await create({ title: "満杯" }, await pngs(MAX_TOPIC_IMAGES));
    const filesBefore = files.size;
    const over = await itemRoute.PATCH(req("PATCH", form({}, await pngs(1))), ctx(full.id));
    expect(over.status).toBe(400);
    expect(imageIds(full.id)).toHaveLength(MAX_TOPIC_IMAGES);
    expect(files.size).toBe(filesBefore); // 追加分は残らない
  });

  it("削除すると全画像のファイルが消える", async () => {
    const t = await create({ title: "x" }, await pngs(3));
    expect((await itemRoute.DELETE(req("DELETE"), ctx(t.id))).status).toBe(200);
    expect(files.size).toBe(0);
  });
});

describe("ユーザー向け（公開側）", () => {
  it("本文または 2 枚以上の画像があれば詳細画面へ遷移する扱いになる", async () => {
    const single = await create({ title: "単体" }, await pngs(1));
    const withBody = await create({ title: "本文", body: "あ" }, await pngs(1));
    const multi = await create({ title: "複数" }, await pngs(2));
    const byId = Object.fromEntries(listPublishedTopics().map((t) => [t.id, t]));
    expect(topicHasDetail(byId[single.id])).toBe(false);
    expect(topicHasDetail(byId[withBody.id])).toBe(true);
    expect(topicHasDetail(byId[multi.id])).toBe(true);
    expect(byId[multi.id].imageCount).toBe(2);
  });

  it("詳細 API・画像 API は公開中のみ返し、非公開は 404、未ログインは 401", async () => {
    const t = await create({ title: "公開", body: "本文" }, await pngs(2));
    const off = await create({ title: "非公開", isPublished: "false" }, await pngs(1));

    const detail = await publicDetailRoute.GET(req("GET"), ctx(t.id));
    expect(detail.status).toBe(200);
    const body = (await detail.json()).topic as { images: Array<{ id: string; src: string }>; body: string };
    expect(body.body).toBe("本文");
    expect(body.images).toHaveLength(2);

    const img = await publicImageRoute.GET(req("GET"), imgCtx(t.id, body.images[1].id));
    expect(img.status).toBe(200);
    expect(img.headers.get("Content-Type")).toBe("image/webp");
    expect((await publicCoverRoute.GET(req("GET"), ctx(t.id))).status).toBe(200);

    expect((await publicDetailRoute.GET(req("GET"), ctx(off.id))).status).toBe(404);
    expect((await publicImageRoute.GET(req("GET"), imgCtx(off.id, off.images[0].id))).status).toBe(404);
    // 他トピックスの画像 ID では取れない。
    expect((await publicImageRoute.GET(req("GET"), imgCtx(t.id, off.images[0].id))).status).toBe(404);

    getSessionMock.mockResolvedValue(null);
    expect((await publicDetailRoute.GET(req("GET"), ctx(t.id))).status).toBe(401);
    expect((await publicImageRoute.GET(req("GET"), imgCtx(t.id, body.images[0].id))).status).toBe(401);
  });

  it("管理者向けの個別画像は非公開でも取得できる", async () => {
    const off = await create({ title: "非公開", isPublished: "false" }, await pngs(2));
    expect((await adminImageRoute.GET(req("GET"), imgCtx(off.id, off.images[1].id))).status).toBe(200);
    loginAs("USER");
    expect((await adminImageRoute.GET(req("GET"), imgCtx(off.id, off.images[1].id))).status).toBe(403);
  });
});

describe("既存データの移行", () => {
  it("topic_images が無い既存トピックスは、image_key から 1 枚として扱われる", () => {
    // 移行 SQL（db.ts）と同じ文を、画像行を消した状態で再実行して確認する。
    db.prepare(
      "INSERT INTO topics (id, title, image_key, sort_order, is_published) VALUES ('legacy', '旧', 'topic-legacy.webp', 0, 1)",
    ).run();
    db.exec(`
      INSERT INTO topic_images (id, topic_id, image_key, sort_order)
      SELECT lower(hex(randomblob(16))), t.id, t.image_key, 0 FROM topics t
       WHERE t.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM topic_images i WHERE i.topic_id = t.id);
    `);
    const detail = getPublishedTopicDetail("legacy");
    expect(detail?.images).toHaveLength(1);
    expect(detail?.body).toBeNull();
  });
});
