// 大会の multipart フォーム入力を、検証前のオブジェクトへ取り出す（topicForm.ts と同形）。
// 送られていない（または文字列でない）項目は含めない（Zod 側で optional / null 化を適用させるため）。

export const TOURNAMENT_FORM_FIELDS = [
  "title",
  "eventDate",
  "category",
  "tier",
  "venue",
  "capacity",
  "entryFee",
  "startTime",
  "entryStartAt",
  "entryEndAt",
  "description",
  "endTime",
  "prize",
  "courtInfo",
  "teamSizeMin",
  "teamSizeMax",
  "alertThreshold",
  "surface",
  "seriesId",
  "genderDivision",
  "expectedUpdatedAt",
  "copyFromId",
] as const;

export function extractTournamentFields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TOURNAMENT_FORM_FIELDS) {
    const v = form.get(key);
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

// 要項画像のバイト列を取り出す。未添付・空ファイルは null。
export async function readImageFile(form: FormData, name = "file"): Promise<Uint8Array | null> {
  const v = form.get(name);
  if (!v || typeof v === "string") return null;
  if (v.size === 0) return null;
  return new Uint8Array(await v.arrayBuffer());
}
