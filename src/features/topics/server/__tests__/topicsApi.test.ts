import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SessionPayload, User } from "@/types/user";

// ---- 外部依存のモック ----
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

// 画像ストレージはメモリ上の偽物にする（ディスクを汚さない）。
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
import * as reorderRoute from "@/app/api/admin/topics/reorder/route";
import * as imageRoute from "@/app/api/admin/topics/[id]/image/route";
import { listPublishedTopics } from "@/features/topics/server/topicRepository";
import { MAX_TOPIC_UPLOAD_BYTES } from "@/features/topics/server/imageProcessor";

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

function loginAs(role: User["role"] | null) {
  if (!role) {
    getSessionMock.mockResolvedValue(null);
    return;
  }
  const u = makeUser(role);
  getSessionMock.mockResolvedValue({ sub: u.id, loginId: u.loginId, role, isAdmin: false });
  findUserByIdMock.mockReturnValue(u);
}

async function png(width = 2000, height = 1000): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

function form(fields: Record<string, string>, file?: Uint8Array | File): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file instanceof File) fd.set("file", file);
  else if (file) fd.set("file", new File([file as BlobPart], "a.png", { type: "image/png" }));
  return fd;
}

const req = (method: string, body?: BodyInit, headers?: HeadersInit) =>
  new Request("http://x/api/admin/topics", { method, body, headers });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function createViaApi(fields: Record<string, string>) {
  const res = await listRoute.POST(req("POST", form(fields, await png())), undefined);
  expect(res.status).toBe(201);
  return (await res.json()).topic as { id: string; sortOrder: number; status: string };
}

beforeEach(() => {
  db.exec("DELETE FROM topics");
  files.clear();
  getSessionMock.mockReset();
  findUserByIdMock.mockReset();
});

describe("権限のないユーザーは 403 / 未ログインは 401", () => {
  it.each(["USER", "LEADER"] as const)("%s は追加・編集・削除・並び替え・一覧・画像がすべて 403", async (role) => {
    loginAs("ADMIN");
    const t = await createViaApi({ title: "既存" });
    loginAs(role);

    expect((await listRoute.POST(req("POST", form({ title: "x" }, await png())), undefined)).status).toBe(403);
    expect((await itemRoute.PATCH(req("PATCH", form({ title: "y" })), ctx(t.id))).status).toBe(403);
    expect((await itemRoute.DELETE(req("DELETE"), ctx(t.id))).status).toBe(403);
    expect(
      (await reorderRoute.POST(req("POST", JSON.stringify({ ids: [t.id] })), undefined)).status,
    ).toBe(403);
    expect((await listRoute.GET(req("GET"), undefined)).status).toBe(403);
    expect((await imageRoute.GET(req("GET"), ctx(t.id))).status).toBe(403);

    // 何も変更されていない。
    const row = db.prepare("SELECT title, deleted_at FROM topics WHERE id = ?").get(t.id) as {
      title: string;
      deleted_at: string | null;
    };
    expect(row).toEqual({ title: "既存", deleted_at: null });
    expect(files.size).toBe(1);
  });

  it("未ログインは 401", async () => {
    loginAs(null);
    expect((await listRoute.POST(req("POST", form({ title: "x" }, await png())), undefined)).status).toBe(401);
    expect((await itemRoute.DELETE(req("DELETE"), ctx("any"))).status).toBe(401);
  });
});

describe("ADMIN / OPERATOR の操作", () => {
  it("OPERATOR も追加でき、画像は WebP・長辺1280px以下に変換して保存される", async () => {
    loginAs("OPERATOR");
    const t = await createViaApi({ title: "新着", linkUrl: "/tournaments" });

    const key = (db.prepare("SELECT image_key FROM topics WHERE id = ?").get(t.id) as { image_key: string })
      .image_key;
    expect(key.endsWith(".webp")).toBe(true);
    const meta = await sharp(Buffer.from(files.get(key)!)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1280);
  });

  it("追加したトピックスがホームの公開一覧に出る", async () => {
    loginAs("ADMIN");
    const t = await createViaApi({ title: "ホームに出る" });
    expect(listPublishedTopics().map((x) => x.id)).toContain(t.id);
  });

  it("非公開・公開前・期間外は公開一覧に出ず、管理一覧では状態が区別できる", async () => {
    loginAs("ADMIN");
    const pub = await createViaApi({ title: "公開", isPublished: "true" });
    const off = await createViaApi({ title: "非公開", isPublished: "false" });
    const future = await createViaApi({ title: "公開前", isPublished: "true", publishFrom: "2999-01-01T00:00" });
    const past = await createViaApi({ title: "期間外", isPublished: "true", publishUntil: "2000-01-01T00:00" });

    const body = await (await listRoute.GET(req("GET"), undefined)).json();
    const status = Object.fromEntries(body.topics.map((x: { id: string; status: string }) => [x.id, x.status]));
    expect(status).toEqual({
      [pub.id]: "PUBLISHED",
      [off.id]: "UNPUBLISHED",
      [future.id]: "SCHEDULED",
      [past.id]: "EXPIRED",
    });
    expect(listPublishedTopics().map((x) => x.id)).toEqual([pub.id]);
  });

  it("公開切替・編集（画像差し替えで旧画像を削除）ができる", async () => {
    loginAs("ADMIN");
    const t = await createViaApi({ title: "元" });
    const oldKey = (db.prepare("SELECT image_key FROM topics WHERE id = ?").get(t.id) as { image_key: string })
      .image_key;

    expect((await itemRoute.PATCH(req("PATCH", form({ isPublished: "false" })), ctx(t.id))).status).toBe(200);
    expect(listPublishedTopics()).toHaveLength(0);

    const res = await itemRoute.PATCH(
      req("PATCH", form({ title: "新", isPublished: "true" }, await png(300, 300))),
      ctx(t.id),
    );
    expect(res.status).toBe(200);
    expect(listPublishedTopics().map((x) => x.title)).toEqual(["新"]);
    expect(files.has(oldKey)).toBe(false);
    expect(files.size).toBe(1);
  });

  it("削除は論理削除で、画像ファイルは消え、公開・管理の両方から見えなくなる", async () => {
    loginAs("ADMIN");
    const t = await createViaApi({ title: "消す" });
    expect(files.size).toBe(1);

    expect((await itemRoute.DELETE(req("DELETE"), ctx(t.id))).status).toBe(200);

    const row = db.prepare("SELECT deleted_at FROM topics WHERE id = ?").get(t.id) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull(); // 行は残る（論理削除）
    expect(files.size).toBe(0);
    expect(listPublishedTopics()).toHaveLength(0);
    expect((await listRoute.GET(req("GET"), undefined).then((r) => r.json())).topics).toHaveLength(0);
    expect((await itemRoute.DELETE(req("DELETE"), ctx(t.id))).status).toBe(404);
  });

  it("並び替えが公開一覧の順序に反映される（件数不一致は 409）", async () => {
    loginAs("ADMIN");
    const a = await createViaApi({ title: "A" });
    const b = await createViaApi({ title: "B" });
    const c = await createViaApi({ title: "C" });
    expect(listPublishedTopics().map((x) => x.title)).toEqual(["A", "B", "C"]);

    const ok = await reorderRoute.POST(req("POST", JSON.stringify({ ids: [c.id, a.id, b.id] })), undefined);
    expect(ok.status).toBe(200);
    expect(listPublishedTopics().map((x) => x.title)).toEqual(["C", "A", "B"]);

    const bad = await reorderRoute.POST(req("POST", JSON.stringify({ ids: [a.id] })), undefined);
    expect(bad.status).toBe(409);
  });
});

describe("入力検証", () => {
  it("画像なし・非対応形式・10MB超・不正なリンク先は拒否される", async () => {
    loginAs("ADMIN");

    expect((await listRoute.POST(req("POST", form({ title: "x" })), undefined)).status).toBe(400);

    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0]);
    expect((await listRoute.POST(req("POST", form({ title: "x" }, gif)), undefined)).status).toBe(415);

    const big = new File([new Uint8Array(MAX_TOPIC_UPLOAD_BYTES + 1)], "big.png");
    expect((await listRoute.POST(req("POST", form({ title: "x" }, big)), undefined)).status).toBe(413);

    for (const linkUrl of ["javascript:alert(1)", "//evil.example", "http://insecure.example"]) {
      const res = await listRoute.POST(req("POST", form({ title: "x", linkUrl }, await png())), undefined);
      expect(res.status).toBe(400);
    }

    expect(db.prepare("SELECT COUNT(*) AS c FROM topics").get()).toEqual({ c: 0 });
    expect(files.size).toBe(0);
  });

  it("タイトル必須・公開終了が開始より前なら 400", async () => {
    loginAs("ADMIN");
    expect((await listRoute.POST(req("POST", form({ title: "  " }, await png())), undefined)).status).toBe(400);
    const res = await listRoute.POST(
      req("POST", form({ title: "x", publishFrom: "2030-02-01T00:00", publishUntil: "2030-01-01T00:00" }, await png())),
      undefined,
    );
    expect(res.status).toBe(400);
  });
});
