// 画像ストレージの抽象。現状はローカルディスク実装。
// 本番で Supabase Storage / S3 へ移行する際は、この interface を満たす実装へ差し替える
// （DB の avatar_url には「保存キー」だけを持たせるため、画面・DBは変更不要）。

import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface ImageStorage {
  // 保存して保存キーを返す。
  save(prefix: string, bytes: Uint8Array, extension: string): Promise<string>;
  // 読み出す。無ければ null。
  read(key: string): Promise<Uint8Array | null>;
  // 削除する（無くてもエラーにしない）。
  delete(key: string): Promise<void>;
}

// 保存キーとして許可する形式（パストラバーサル防止）。
const KEY_PATTERN = /^[A-Za-z0-9_-]+\.(png|jpg|webp)$/;

export function createLocalImageStorage(
  baseDir: string = process.env.GRAN_UPLOAD_DIR || path.join(process.cwd(), "data", "uploads"),
): ImageStorage {
  const resolve = (key: string): string | null =>
    KEY_PATTERN.test(key) ? path.join(baseDir, key) : null;

  return {
    async save(prefix, bytes, extension) {
      const key = `${prefix}-${randomBytes(8).toString("hex")}.${extension}`;
      const file = resolve(key);
      if (!file) throw new Error("invalid storage key");
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(file, bytes);
      return key;
    },
    async read(key) {
      const file = resolve(key);
      if (!file) return null;
      try {
        return new Uint8Array(await fs.readFile(file));
      } catch {
        return null;
      }
    },
    async delete(key) {
      const file = resolve(key);
      if (!file) return;
      await fs.rm(file, { force: true });
    },
  };
}

export const imageStorage: ImageStorage = createLocalImageStorage();
