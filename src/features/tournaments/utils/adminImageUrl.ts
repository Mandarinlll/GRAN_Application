// 要項画像 URL の生成と保存キーの抽出（純粋関数）。

const URL_PREFIX = "/api/tournaments/image/";
const KEY_URL_PATTERN = /^\/api\/tournaments\/image\/([A-Za-z0-9_-]+\.(?:png|jpg|webp))$/;

export function toImageUrl(key: string): string {
  return `${URL_PREFIX}${key}`;
}

// 管理対象の画像 URL なら保存キーを返す。シードの外部 URL など一致しない値は null（管理対象外）。
export function parseImageKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = KEY_URL_PATTERN.exec(url);
  return m ? m[1] : null;
}
