// チームメンバー除名 API（DELETE, 本文なし）。ADMIN のみ（認可はサービス層）。
import { NextResponse } from "next/server";
import { MSG_NOT_FOUND } from "@/features/accounts/server/accessResult";
import { guarded, toResponse } from "@/features/accounts/server/httpResult";
import { removeTeamMember } from "@/features/accounts/server/teamAdminService";

type Ctx = { params: Promise<{ id: string; userId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, { params }: Ctx): Promise<NextResponse> {
  return guarded(async () => {
    const { id, userId } = await params;
    if (!UUID_RE.test(id) || !UUID_RE.test(userId)) {
      return toResponse({ ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND });
    }
    return toResponse(await removeTeamMember(id, userId));
  });
}
