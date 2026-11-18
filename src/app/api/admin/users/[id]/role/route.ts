// 権限変更 API（POST, JSON { role }）。
import { NextResponse } from "next/server";
import { badRequest, guarded, toResponse } from "@/features/accounts/server/httpResult";
import { notFoundResponse, readJsonObject, UUID_RE } from "@/features/accounts/server/routeHelpers";
import { changeUserRole } from "@/features/accounts/server/userAdminService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  return guarded(async () => {
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFoundResponse();
    const body = await readJsonObject(req);
    if (!body) return badRequest();
    return toResponse(await changeUserRole(id, body.role));
  });
}
