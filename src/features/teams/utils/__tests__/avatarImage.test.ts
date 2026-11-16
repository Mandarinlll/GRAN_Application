// チームアイコン画像の検証・保存のユニットテスト。
import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contentTypeOfKey, detectAvatarType } from "@/features/teams/utils/avatarImage";
import { createLocalImageStorage } from "@/features/teams/server/imageStorage";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

describe("detectAvatarType", () => {
  it("PNG/JPEG/WebP を先頭バイトで判定する", () => {
    expect(detectAvatarType(new Uint8Array(PNG))).toBe("image/png");
    expect(detectAvatarType(new Uint8Array(JPG))).toBe("image/jpeg");
    expect(detectAvatarType(new Uint8Array(WEBP))).toBe("image/webp");
  });
  it("SVG・GIF・空データは拒否する", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(detectAvatarType(svg)).toBeNull();
    expect(detectAvatarType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectAvatarType(new Uint8Array())).toBeNull();
  });
});

describe("contentTypeOfKey", () => {
  it("拡張子から Content-Type を返し、未知の拡張子は null", () => {
    expect(contentTypeOfKey("a-1.png")).toBe("image/png");
    expect(contentTypeOfKey("a-1.jpg")).toBe("image/jpeg");
    expect(contentTypeOfKey("a-1.svg")).toBeNull();
  });
});

describe("local image storage", () => {
  it("保存・読み出し・削除ができ、不正なキーは扱わない", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gran-img-"));
    const storage = createLocalImageStorage(dir);
    const key = await storage.save("team-1", new Uint8Array(PNG), "png");
    expect(key).toMatch(/^team-1-[0-9a-f]{16}\.png$/);
    expect(Array.from((await storage.read(key))!)).toEqual(PNG);

    await storage.delete(key);
    expect(await storage.read(key)).toBeNull();

    expect(await storage.read("../../etc/passwd")).toBeNull();
    await expect(storage.save("../x", new Uint8Array(PNG), "png")).rejects.toThrow();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
