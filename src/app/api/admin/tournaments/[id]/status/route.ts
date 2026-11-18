// 大会のステータス変更 API（POST, JSON）。中止（CANCELLED）もここで扱う。ADMIN のみ。
import { NextResponse } from "next/server";
import { withAdminApi } from "@/features/admin/server/guard";
import { badRequest, errorResponse, guarded } from "@/features/tournaments/server/httpResult";
import { changeStatus } from "@/features/tournaments/server/tournamentAdminService";
import type { TournamentStatus } from "@/features/tournaments/types/tournament";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES: readonly string[] = ["DRAFT", "UPCOMING", "OPEN", "CLOSED", "FINISHED", "CANCELLED"];
const isStatus = (v: unknown): v is TournamentStatus => typeof v === "string" && STATUSES.includes(v);

export const POST = withAdminApi<Ctx>("tournaments.manage", (req, { params }, admin) =>
  guarded(async () => {
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest();
    }
    const b = (body ?? {}) as Record<string, unknown>;
    if (!isStatus(b.to) || !isStatus(b.expectedStatus) || typeof b.expectedUpdatedAt !== "string") {
      return badRequest();
    }

    const result = await changeStatus(admin, id, {
      to: b.to,
      expectedStatus: b.expectedStatus,
      expectedUpdatedAt: b.expectedUpdatedAt,
    });
    if (!result.ok) return errorResponse(result);
    return NextResponse.json({
      ok: true,
      status: result.data.status,
      updatedAt: result.data.updatedAt,
      notify: result.data.notify,
      message: "ステータスを変更しました。",
      fieldErrors: {},
    });
  }),
);
