// トピックス管理 API: 一覧（GET）・新規追加（POST, multipart）。
// ADMIN / OPERATOR のみ（withAdminApi が 401 / 403 を返す）。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import { createTopic, getTopicById, listAllTopics } from "@/features/topics/server/topicAdminRepository";
import { extractTopicFields, flattenIssues } from "@/features/topics/server/topicForm";
import { deleteKeys, filesOf, saveTopicUploads } from "@/features/topics/server/topicUploads";
import { createTopicSchema } from "@/features/topics/types/schema";
import { MAX_TOPIC_IMAGES } from "@/features/topics/types/topic";

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

  // 画像は `files`（複数）。旧形式の `file`（1 枚）も受け付ける。先頭がカバー画像になる。
  const uploads = [...filesOf(form, "file"), ...filesOf(form, "files")];
  if (uploads.length === 0) {
    return NextResponse.json(
      { ok: false, message: "画像ファイルを選択してください。" },
      { status: 400 },
    );
  }
  if (uploads.length > MAX_TOPIC_IMAGES) {
    return NextResponse.json(
      { ok: false, message: `画像は${MAX_TOPIC_IMAGES}枚までです。` },
      { status: 400 },
    );
  }
  const saved = await saveTopicUploads(uploads);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message }, { status: saved.status });
  }
  let id: string;
  try {
    id = createTopic(parsed.data, saved.keys);
  } catch (e) {
    await deleteKeys(saved.keys);
    throw e;
  }  revalidatePath("/home");
  return NextResponse.json({ ok: true, topic: getTopicById(id) }, { status: 201 });
});
