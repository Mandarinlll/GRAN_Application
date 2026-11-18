// 大会要項画像の検証・加工。
// PNG / JPEG / WebP のみ受け付け（マジックナンバーで判定）、最大 5MB。
// サーバー側で長辺を縮小し WebP へ変換する。
import sharp from "sharp";
import { detectAvatarType } from "@/features/teams/utils/avatarImage";

export const MAX_TOURNAMENT_UPLOAD_BYTES = 5_242_880; // 5MB
export const TOURNAMENT_IMAGE_MAX_WIDTH = 1280;
const TOURNAMENT_IMAGE_QUALITY = 80;
// 画素数の上限（巨大画像によるメモリ枯渇を防ぐ）。
const MAX_INPUT_PIXELS = 50_000_000;

export type TournamentImageResult =
  | { ok: true; bytes: Uint8Array; extension: "webp" }
  | { ok: false; status: 413 | 415; message: string };

export async function processTournamentImage(input: Uint8Array): Promise<TournamentImageResult> {
  if (input.byteLength > MAX_TOURNAMENT_UPLOAD_BYTES) {
    return { ok: false, status: 413, message: "画像は5MB以下にしてください。" };
  }
  if (!detectAvatarType(input)) {
    return { ok: false, status: 415, message: "PNG・JPEG・WebP の画像のみ登録できます。" };
  }
  try {
    const out = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // EXIF の向きを反映
      .resize({ width: TOURNAMENT_IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: TOURNAMENT_IMAGE_QUALITY })
      .toBuffer();
    return { ok: true, bytes: new Uint8Array(out), extension: "webp" };
  } catch {
    return { ok: false, status: 415, message: "画像を読み込めませんでした。別のファイルをお試しください。" };
  }
}
