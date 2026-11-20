// トピックス詳細（GET）。ログイン必須。公開中でなければ 404。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPublishedTopicDetail } from "@/features/topics/server/topicRepository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const topic = getPublishedTopicDetail(id);
  if (!topic) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, topic });
}
