import { db } from "@/lib/db";
import { createDataRepository } from "@/features/data/server/dataRepository";
import { ApiError, withDataHandler } from "@/features/data/server/handlers";
import { tournamentIdParamsSchema } from "@/features/data/server/querySchemas";

export const dynamic = "force-dynamic";

const repo = createDataRepository(db);

export const GET = withDataHandler<Record<string, never>, { tournamentId: string }>(
  ({ userId, params }) => {
    const parsed = tournamentIdParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new ApiError("BAD_REQUEST", "リクエストの内容が正しくありません。");
    }
    return repo.getParticipationDetail(userId, parsed.data.tournamentId);
  },
);
