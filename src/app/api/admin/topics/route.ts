// トピックス管理 API: 一覧（GET）・新規追加（POST, multipart）。
// ADMIN / OPERATOR のみ（withAdminApi が 401 / 403 を返す）。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import { imageStorage } from "@/features/teams/server/imageStorage";
import { processTopicImage } from "@/features/topics/server/imageProcessor";
import { createTopic, getTopicById, listAllTopics } from "@/features/topics/server/topicAdminRepository";
import { extractTopicFields, flattenIssues } from "@/features/topics/server/topicForm";
import { createTopicSchema } from "@/features/topics/types/schema";

export const GET = withAdminApi("topics.manage", () =>
  NextResponse.json({ ok: true, topics: listAllTopics() }),
);

export const POST = withAdminApi("topics.manage", async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "リクエストが不正です。" }, { status: 400 });
  }

  const parsed = createTopicSchema.safeParse(extractTopicFields(form));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "入力内容をご確認ください。", fieldErrors: flattenIssues(parsed.error) },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "画像ファイルを選択してください。" },
      { status: 400 },
    );
  }
  const image = await processTopicImage(new Uint8Array(await file.arrayBuffer()));
  if (!image.ok) {
    return NextResponse.json({ ok: false, message: image.message }, { status: image.status });
  }

  const key = await imageStorage.save("topic", image.bytes, image.extension);
  let id: string;
  try {
    id = createTopic(parsed.data, key);
  } catch (e) {
    await imageStorage.delete(key);
    throw e;
  }

  revalidatePath("/home");
  return NextResponse.json({ ok: true, topic: getTopicById(id) }, { status: 201 });
});
