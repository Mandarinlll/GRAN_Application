// ユーザー作成 API（POST, JSON）。認可はサービス層。
import { NextResponse } from "next/server";
import { badRequest, guarded, toResponse } from "@/features/accounts/server/httpResult";
import { readJsonObject } from "@/features/accounts/server/routeHelpers";
import { createUser } from "@/features/accounts/server/userAdminService";

export async function POST(req: Request): Promise<NextResponse> {
  return guarded(async () => {
    const body = await readJsonObject(req);
    if (!body) return badRequest();
    const result = await createUser(body);
    return toResponse(result, (d) => ({
      id: d.id,
      loginId: d.loginId,
      initialPassword: d.initialPassword,
    }));
  });
}
