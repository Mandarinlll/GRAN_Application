// トピックス画像の配信（GET）。ログイン必須。公開中のトピックスのみ返す。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPublishedTopicImageKey } from "@/features/topics/server/topicRepository";
import { imageStorage } from "@/features/teams/server/imageStorage";
import { contentTypeOfKey } from "@/features/teams/utils/avatarImage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;

  const key = getPublishedTopicImageKey(id);
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
}
