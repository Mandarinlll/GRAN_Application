// トピックス画像（個別）の管理者向けプレビュー配信（GET）。公開状態に関係なく返す。ADMIN / OPERATOR のみ。
import { NextResponse } from "next/server";
import { withAdminApi } from "@/features/admin/server/guard";
import { imageStorage } from "@/features/teams/server/imageStorage";
import { getTopicImageKey } from "@/features/topics/server/topicAdminRepository";
import { contentTypeOfKey } from "@/features/teams/utils/avatarImage";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

export const GET = withAdminApi<Ctx>("topics.manage", async (_req, { params }) => {
  const { id, imageId } = await params;
  const key = getTopicImageKey(id, imageId);
  const type = key ? contentTypeOfKey(key) : null;
  const bytes = key && type ? await imageStorage.read(key) : null;
  if (!bytes || !type) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
