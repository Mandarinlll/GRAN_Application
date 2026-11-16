// チームアイコン画像の配信（GET）・アップロード/差し替え（POST）・削除（DELETE）。
// すべてログイン必須。POST/DELETE はそのチームの代表者のみ。
// Cookie は SameSite=Lax のため、他サイトからの POST/DELETE にはセッションが付かない。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getTeamAvatarKey,
  isTeamLeaderOf,
  setTeamAvatarKey,
} from "@/features/teams/server/teamPageRepository";
import { imageStorage } from "@/features/teams/server/imageStorage";
import {
  AVATAR_EXTENSION,
  MAX_AVATAR_BYTES,
  contentTypeOfKey,
  detectAvatarType,
  teamAvatarSrc,
} from "@/features/teams/utils/avatarImage";
import { revalidatePath } from "next/cache";

type Ctx = { params: Promise<{ id: string }> };

function error(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return error(401, "ログインしてください。");
  const { id } = await params;

  const key = getTeamAvatarKey(id);
  const type = key ? contentTypeOfKey(key) : null;
  const bytes = key && type ? await imageStorage.read(key) : null;
  if (!bytes || !type) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return error(401, "ログインしてください。");
  const { id } = await params;
  if (!isTeamLeaderOf(id, session.sub)) return error(403, "代表者のみ変更できます。");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return error(400, "リクエストが不正です。");
  }
  if (!(file instanceof File)) return error(400, "画像ファイルを選択してください。");
  if (file.size === 0) return error(400, "空のファイルです。");
  if (file.size > MAX_AVATAR_BYTES) return error(413, "画像は2MB以下にしてください。");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectAvatarType(bytes);
  if (!type) return error(415, "PNG・JPEG・WebP の画像のみ登録できます。");

  const oldKey = getTeamAvatarKey(id);
  const newKey = await imageStorage.save(id, bytes, AVATAR_EXTENSION[type]);
  try {
    setTeamAvatarKey(id, newKey);
  } catch (e) {
    await imageStorage.delete(newKey);
    throw e;
  }
  if (oldKey) await imageStorage.delete(oldKey);

  revalidatePath("/team");
  revalidatePath(`/team/${id}`);
  return NextResponse.json({ ok: true, src: teamAvatarSrc(id, newKey) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return error(401, "ログインしてください。");
  const { id } = await params;
  if (!isTeamLeaderOf(id, session.sub)) return error(403, "代表者のみ変更できます。");

  const oldKey = getTeamAvatarKey(id);
  setTeamAvatarKey(id, null);
  if (oldKey) await imageStorage.delete(oldKey);

  revalidatePath("/team");
  revalidatePath(`/team/${id}`);
  return NextResponse.json({ ok: true });
}
