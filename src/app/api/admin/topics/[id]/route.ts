// トピックス管理 API: 編集（PATCH, multipart）・削除（DELETE, 論理削除）。
// ADMIN / OPERATOR のみ。PATCH は送られた項目だけを更新する（公開切替は isPublished のみ送る）。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import { getTopicById, softDeleteTopic, updateTopic } from "@/features/topics/server/topicAdminRepository";
import { extractTopicFields, flattenIssues } from "@/features/topics/server/topicForm";
import { deleteKeys, filesOf, saveTopicUploads } from "@/features/topics/server/topicUploads";
import { updateTopicSchema } from "@/features/topics/types/schema";
import { MAX_TOPIC_IMAGES } from "@/features/topics/types/topic";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ ok: false, message: "トピックスが見つかりません。" }, { status: 404 });

export const PATCH = withAdminApi<Ctx>("topics.manage", async (req, { params }) => {
  const { id } = await params;
  const existing = getTopicById(id);
  if (!existing) return notFound();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "リクエストが不正です。" }, { status: 400 });
  }

  // 期間の前後関係は、送られなかった側の現在値と合わせて検証する。
  const fields = extractTopicFields(form);
  const parsed = updateTopicSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "入力内容をご確認ください。", fieldErrors: flattenIssues(parsed.error) },
      { status: 400 },
    );
  }
  const from = parsed.data.publishFrom !== undefined ? parsed.data.publishFrom : existing.publishFrom;
  const until = parsed.data.publishUntil !== undefined ? parsed.data.publishUntil : existing.publishUntil;
  if (from && until && from > until) {
    return NextResponse.json(
      {
        ok: false,
        message: "入力内容をご確認ください。",
        fieldErrors: { publishUntil: "公開終了は公開開始より後にしてください" },
      },
      { status: 400 },
    );
  }

  // 画像は任意。
  //  files          : 末尾に追加する新規画像（複数可）
  //  file           : カバー画像（先頭）の差し替え（旧形式）
  //  removeImageIds : 削除する既存画像ID（複数可）
  //  imageOrder     : 既存画像IDの並び（複数可。先頭がカバー画像）
  const addFiles = filesOf(form, "files");
  const coverFile = filesOf(form, "file")[0];
  if (addFiles.length + (coverFile ? 1 : 0) > MAX_TOPIC_IMAGES) {
    return NextResponse.json(
      { ok: false, message: `画像は${MAX_TOPIC_IMAGES}枚までです。` },
      { status: 400 },
    );
  }
  const saved = await saveTopicUploads(coverFile ? [coverFile, ...addFiles] : addFiles);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message }, { status: saved.status });
  }
  const strings = (name: string) => form.getAll(name).filter((v): v is string => typeof v === "string");
  const order = strings("imageOrder");

  let result: ReturnType<typeof updateTopic>;
  try {
    result = updateTopic(id, parsed.data, {
      addKeys: coverFile ? saved.keys.slice(1) : saved.keys,
      replaceCoverKey: coverFile ? saved.keys[0] : undefined,
      removeIds: strings("removeImageIds"),
      order: order.length > 0 ? order : undefined,
    });
  } catch (e) {
    await deleteKeys(saved.keys);
    throw e;
  }
  if (!result.ok) {
    await deleteKeys(saved.keys);
    if (result.reason === "NOT_FOUND") return notFound();
    const message =
      result.reason === "NO_IMAGE" ? "画像は1枚以上必要です。" : `画像は${MAX_TOPIC_IMAGES}枚までです。`;
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
  await deleteKeys(result.deleteKeys);

  revalidatePath("/home");
  return NextResponse.json({ ok: true, topic: getTopicById(id) });
});

export const DELETE = withAdminApi<Ctx>("topics.manage", async (_req, { params }) => {
  const { id } = await params;
  const deleted = softDeleteTopic(id);
  if (!deleted) return notFound();
  // 論理削除でも画像ファイルは消す（行は監査用に残す）。
  await deleteKeys(deleted.imageKeys);
  revalidatePath("/home");
  return NextResponse.json({ ok: true });
});
