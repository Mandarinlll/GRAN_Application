// チーム解散 API（DELETE, JSON { confirmName }）。ADMIN のみ（認可はサービス層）。
import { NextResponse } from "next/server";
import { MSG_NOT_FOUND } from "@/features/accounts/server/accessResult";
import { badRequest, guarded, toResponse } from "@/features/accounts/server/httpResult";
import { disbandTeamAsAdmin } from "@/features/accounts/server/teamAdminService";

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req: Request, { params }: Ctx): Promise<NextResponse> {
  return guarded(async () => {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return toResponse({ ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest();
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return badRequest();

    const result = await disbandTeamAsAdmin(id, (body as Record<string, unknown>).confirmName);
    return toResponse(result, (data) => (data.warning ? { warning: data.warning } : {}));
  });
}
