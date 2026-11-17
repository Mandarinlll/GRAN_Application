// トピックス管理 API: 表示順の更新（POST, JSON { ids: string[] }）。ADMIN / OPERATOR のみ。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import { reorderTopics } from "@/features/topics/server/topicAdminRepository";
import { reorderSchema } from "@/features/topics/types/schema";

export const POST = withAdminApi("topics.manage", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "リクエストが不正です。" }, { status: 400 });
  }
  if (!reorderTopics(parsed.data.ids)) {
    return NextResponse.json(
      { ok: false, message: "一覧が更新されています。再読み込みしてください。" },
      { status: 409 },
    );
  }
  revalidatePath("/home");
  return NextResponse.json({ ok: true });
});
