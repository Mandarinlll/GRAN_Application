// 大会管理 API: 登録・コピー作成（POST, multipart）。ADMIN のみ。
import { NextResponse } from "next/server";
import { withAdminApi } from "@/features/admin/server/guard";
import { badRequest, errorResponse, guarded } from "@/features/tournaments/server/httpResult";
import { extractTournamentFields, readImageFile } from "@/features/tournaments/server/tournamentForm";
import { createTournament } from "@/features/tournaments/server/tournamentAdminService";

export const POST = withAdminApi("tournaments.manage", (req, _ctx, admin) =>
  guarded(async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest();
    }
    const fields = extractTournamentFields(form);
    const { copyFromId, ...raw } = fields;
    const file = await readImageFile(form);

    const result = await createTournament(admin, raw, file, copyFromId || null);
    if (!result.ok) return errorResponse(result);
    return NextResponse.json(
      { ok: true, id: result.data.id, message: "大会を登録しました。", fieldErrors: {} },
      { status: 201 },
    );
  }),
);
