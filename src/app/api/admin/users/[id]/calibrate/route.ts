// 初期レベル査定 API（POST, JSON { granLevel, confirmOutOfRange? }）。
import { NextResponse } from "next/server";
import { badRequest, guarded, toResponse } from "@/features/accounts/server/httpResult";
import { notFoundResponse, readJsonObject, UUID_RE } from "@/features/accounts/server/routeHelpers";
import { calibrateUser } from "@/features/accounts/server/userAdminService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  return guarded(async () => {
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFoundResponse();
    const body = await readJsonObject(req);
    if (!body) return badRequest();
    const result = await calibrateUser(id, body.granLevel, body.confirmOutOfRange);
    return toResponse(result, (d) => ({ ...d }));
  });
}
