// トピックス管理 API: 編集（PATCH, multipart）・削除（DELETE, 論理削除）。
// ADMIN / OPERATOR のみ。PATCH は送られた項目だけを更新する（公開切替は isPublished のみ送る）。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import { imageStorage } from "@/features/teams/server/imageStorage";
import { processTopicImage } from "@/features/topics/server/imageProcessor";
import { getTopicById, softDeleteTopic, updateTopic } from "@/features/topics/server/topicAdminRepository";
import { extractTopicFields, flattenIssues } from "@/features/topics/server/topicForm";
import { updateTopicSchema } from "@/features/topics/types/schema";

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

  // 画像は任意。指定があれば検証・加工して差し替える。
  let newKey: string | undefined;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const image = await processTopicImage(new Uint8Array(await file.arrayBuffer()));
    if (!image.ok) {
      return NextResponse.json({ ok: false, message: image.message }, { status: image.status });
    }
    newKey = await imageStorage.save("topic", image.bytes, image.extension);
  }

  let result: ReturnType<typeof updateTopic>;
  try {
    result = updateTopic(id, parsed.data, newKey);
  } catch (e) {
    if (newKey) await imageStorage.delete(newKey);
    throw e;
  }
  if (!result) {
    if (newKey) await imageStorage.delete(newKey);
    return notFound();
  }
  if (newKey) await imageStorage.delete(result.oldImageKey);

  revalidatePath("/home");
  return NextResponse.json({ ok: true, topic: getTopicById(id) });
});

export const DELETE = withAdminApi<Ctx>("topics.manage", async (_req, { params }) => {
  const { id } = await params;
  const deleted = softDeleteTopic(id);
  if (!deleted) return notFound();
  // 論理削除でも画像ファイルは消す（行は監査用に残す）。
  await imageStorage.delete(deleted.imageKey);

  revalidatePath("/home");
  return NextResponse.json({ ok: true });
});
