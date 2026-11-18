// 大会要項画像の配信（GET）。ログイン必須。管理対象のキー形式のみ返す。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { imageStorage } from "@/features/teams/server/imageStorage";
import { contentTypeOfKey } from "@/features/teams/utils/avatarImage";
import { parseImageKey, toImageUrl } from "@/features/tournaments/utils/adminImageUrl";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { key: rawKey } = await params;

  // KEY_PATTERN と同じ厳密な形式に一致するキーだけを読み出す。
  const key = parseImageKey(toImageUrl(rawKey));
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
