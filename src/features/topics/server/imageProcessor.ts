// トピックス画像の検証・加工。
// PNG / JPEG / WebP のみ受け付け（マジックナンバーで判定。チームアイコンと同じ検証）、
// 最大 10MB。サーバー側で長辺を縮小し WebP へ変換して保存する。
import sharp from "sharp";
import { detectAvatarType } from "@/features/teams/utils/avatarImage";

export const MAX_TOPIC_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
export const TOPIC_IMAGE_MAX_WIDTH = 1280;
const TOPIC_IMAGE_QUALITY = 80;
// 画素数の上限（巨大画像によるメモリ枯渇を防ぐ）。
const MAX_INPUT_PIXELS = 50_000_000;

export type ProcessResult =
  | { ok: true; bytes: Uint8Array; extension: "webp" }
  | { ok: false; status: 400 | 413 | 415; message: string };

export async function processTopicImage(input: Uint8Array): Promise<ProcessResult> {
  if (input.byteLength === 0) return { ok: false, status: 400, message: "空のファイルです。" };
  if (input.byteLength > MAX_TOPIC_UPLOAD_BYTES) {
    return { ok: false, status: 413, message: "画像は10MB以下にしてください。" };
  }
  if (!detectAvatarType(input)) {
    return { ok: false, status: 415, message: "PNG・JPEG・WebP の画像のみ登録できます。" };
  }
  try {
    const out = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // EXIF の向きを反映
      .resize({ width: TOPIC_IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: TOPIC_IMAGE_QUALITY })
      .toBuffer();
    return { ok: true, bytes: new Uint8Array(out), extension: "webp" };
  } catch {
    return { ok: false, status: 415, message: "画像を読み込めませんでした。別のファイルをお試しください。" };
  }
}
