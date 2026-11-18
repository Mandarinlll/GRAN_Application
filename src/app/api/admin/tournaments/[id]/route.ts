// 大会管理 API: 編集（PATCH, multipart）・削除（DELETE）。ADMIN のみ。
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdminApi } from "@/features/admin/server/guard";
import { badRequest, errorResponse, guarded } from "@/features/tournaments/server/httpResult";
import { extractTournamentFields, readImageFile } from "@/features/tournaments/server/tournamentForm";
import { deleteTournament, updateTournament } from "@/features/tournaments/server/tournamentAdminService";

type Ctx = { params: Promise<{ id: string }> };

function revalidateUserViews() {
  try {
    revalidatePath("/tournaments");
    revalidatePath("/home");
  } catch {
    // 再検証の失敗は保存結果に影響させない。
  }
}

export const PATCH = withAdminApi<Ctx>("tournaments.manage", (req, { params }, admin) =>
  guarded(async () => {
    const { id } = await params;
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest();
    }
    const { copyFromId: _ignored, ...raw } = extractTournamentFields(form);
    void _ignored;
    const file = await readImageFile(form);

    const result = await updateTournament(admin, id, raw, file);
    if (!result.ok) return errorResponse(result);
    revalidateUserViews();
    return NextResponse.json({
      ok: true,
      tournament: result.data,
      message: "大会を更新しました。",
      ...(result.warning ? { warning: result.warning } : {}),
      fieldErrors: {},
    });
  }),
);

export const DELETE = withAdminApi<Ctx>("tournaments.manage", (_req, { params }, admin) =>
  guarded(async () => {
    const { id } = await params;
    const result = await deleteTournament(admin, id);
    if (!result.ok) return errorResponse(result);
    revalidateUserViews();
    return NextResponse.json({
      ok: true,
      message: "大会を削除しました。",
      ...(result.data.imageWarning ? { warning: result.data.imageWarning } : {}),
      fieldErrors: {},
    });
  }),
);
