// 大会の一括登録 API（POST, multipart）。dryRun=true ならプレビューのみ（何も保存しない）。ADMIN のみ。
// フォーム項目: common（JSON）、rows（JSON 配列）、dryRun、file（任意）。
import { NextResponse } from "next/server";
import { withAdminApi } from "@/features/admin/server/guard";
import { badRequest, errorResponse, guarded } from "@/features/tournaments/server/httpResult";
import { readImageFile } from "@/features/tournaments/server/tournamentForm";
import { createBulk, previewBulk } from "@/features/tournaments/server/tournamentAdminService";

function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export const POST = withAdminApi("tournaments.manage", (req, _ctx, admin) =>
  guarded(async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest();
    }
    const common = parseJson(form.get("common"));
    const rows = parseJson(form.get("rows"));
    if (!common || typeof common !== "object" || Array.isArray(common) || !Array.isArray(rows)) {
      return badRequest();
    }
    const raw = { common, rows };
    const file = await readImageFile(form);
    const dryRun = form.get("dryRun") === "true";

    if (dryRun) {
      const result = await previewBulk(admin, raw, file);
      if (!result.ok) return errorResponse(result);
      return NextResponse.json({ ok: true, dryRun: true, rows: result.data.rows, fieldErrors: {} });
    }

    const result = await createBulk(admin, raw, file);
    if (!result.ok) return errorResponse(result);
    return NextResponse.json(
      { ok: true, ids: result.data.ids, message: "大会を一括登録しました。", fieldErrors: {} },
      { status: 201 },
    );
  }),
);
