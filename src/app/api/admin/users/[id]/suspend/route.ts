// アカウント停止 API（POST）。
import { NextResponse } from "next/server";
import { guarded, toResponse } from "@/features/accounts/server/httpResult";
import { notFoundResponse, UUID_RE } from "@/features/accounts/server/routeHelpers";
import { suspendUser } from "@/features/accounts/server/userAdminService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx): Promise<NextResponse> {
  return guarded(async () => {
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFoundResponse();
    return toResponse(await suspendUser(id));
  });
}
