export const MAX_DETAIL_LENGTH = 2000;

// 秘密情報を示すキー名（大文字小文字を区別しない）
const FORBIDDEN_KEY = /password|passwd|hash|token|secret|session|cookie/i;

/**
 * Admin_Account_Log の detail（JSON 文字列）を組み立てる。
 * 秘密情報を示すキー名は例外、JSON 化後 2,000 文字超も例外。
 */
export function buildLogDetail(
  fields: Record<string, string | number | boolean | null>,
): string {
  for (const key of Object.keys(fields)) {
    if (FORBIDDEN_KEY.test(key)) {
      throw new Error(`Forbidden key in log detail: ${key}`);
    }
  }
  const json = JSON.stringify(fields);
  if (json.length > MAX_DETAIL_LENGTH) {
    throw new Error(`Log detail exceeds ${MAX_DETAIL_LENGTH} characters`);
  }
  return json;
}
