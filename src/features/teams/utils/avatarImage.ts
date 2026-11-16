// チームアイコン画像の検証（純粋関数）。
// 拡張子やクライアント申告の Content-Type は信用せず、先頭バイト（マジックナンバー）で判定する。
// SVG は埋め込みスクリプトの恐れがあるため許可しない。

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export type AvatarImageType = "image/png" | "image/jpeg" | "image/webp";

export const AVATAR_EXTENSION: Record<AvatarImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// 画像バイト列から種別を判定する。許可形式でなければ null。
export function detectAvatarType(bytes: Uint8Array): AvatarImageType | null {
  const startsWith = (sig: number[], offset = 0) =>
    bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

// 保存キー（ファイル名）から Content-Type を逆引きする。想定外の拡張子は null。
export function contentTypeOfKey(key: string): AvatarImageType | null {
  const ext = key.split(".").pop();
  const hit = (Object.entries(AVATAR_EXTENSION) as Array<[AvatarImageType, string]>).find(
    ([, e]) => e === ext,
  );
  return hit ? hit[0] : null;
}

// 画面表示用URL。key を v に付けて、差し替え時にブラウザキャッシュを更新させる。
export function teamAvatarSrc(teamId: string, key: string | null): string | null {
  return key ? `/api/teams/${encodeURIComponent(teamId)}/avatar?v=${encodeURIComponent(key)}` : null;
}
