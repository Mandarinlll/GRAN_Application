// トピックス画像のアップロード処理（検証・加工・保存）。POST / PATCH で共通。
import { imageStorage } from "@/features/teams/server/imageStorage";
import { processTopicImage } from "@/features/topics/server/imageProcessor";

export type SaveUploadsResult =
  | { ok: true; keys: string[] }
  | { ok: false; status: 400 | 413 | 415; message: string };

// フォームから空でないファイルを取り出す。
export function filesOf(form: FormData, name: string): File[] {
  return form.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);
}

// 全件を検証・加工して保存する。1 件でも失敗したら保存済み分を消して失敗を返す。
export async function saveTopicUploads(files: File[]): Promise<SaveUploadsResult> {
  const keys: string[] = [];
  for (const file of files) {
    const image = await processTopicImage(new Uint8Array(await file.arrayBuffer()));
    if (!image.ok) {
      await deleteKeys(keys);
      return { ok: false, status: image.status, message: image.message };
    }
    keys.push(await imageStorage.save("topic", image.bytes, image.extension));
  }
  return { ok: true, keys };
}

export async function deleteKeys(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => imageStorage.delete(k)));
}