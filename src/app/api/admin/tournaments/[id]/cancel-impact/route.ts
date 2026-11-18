// 中止確認ダイアログ用の 4 件数（確定数・待ち数・請求中数・入金済み数）を返す。ADMIN のみ。
import { NextResponse } from "next/server";
import { withAdminApi } from "@/features/admin/server/guard";
import { guarded } from "@/features/tournaments/server/httpResult";
import { findAdminTournamentById } from "@/features/tournaments/server/tournamentAdminRepository";
import { getCancelImpact } from "@/features/tournaments/server/tournamentAdminService";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAdminApi<Ctx>("tournaments.manage", (_req, { params }) =>
  guarded(async () => {
    const { id } = await params;
    if (!findAdminTournamentById(id)) {
      return NextResponse.json(
        { ok: false, message: "大会が見つかりません。", fieldErrors: {} },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, impact: getCancelImpact(id), fieldErrors: {} });
  }),
);
