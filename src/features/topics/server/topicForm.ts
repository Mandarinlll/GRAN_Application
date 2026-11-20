// トピックスの multipart フォーム入力を、検証前のオブジェクトへ取り出す。
// 送られていない（または文字列でない）項目は含めない（Zod 側で default / optional を適用させるため）。

const FIELDS = ["title", "body", "linkUrl", "publishFrom", "publishUntil", "isPublished"] as const;

export function extractTopicFields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FIELDS) {
    const v = form.get(key);
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

// Zod のエラーを { field: message } へ平坦化する。
export function flattenIssues(error: import("zod").ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
