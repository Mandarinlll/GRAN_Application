import { db } from "@/lib/db";
import { createDataRepository } from "@/features/data/server/dataRepository";
import { withDataHandler } from "@/features/data/server/handlers";
import { categoryRankingQuerySchema } from "@/features/data/server/querySchemas";

export const dynamic = "force-dynamic";

const repo = createDataRepository(db);

export const GET = withDataHandler(
  ({ userId, query }) => ({
    category: query.category,
    ...repo.getCategoryRanking(userId, query.category, query.offset, query.limit),
  }),
  { querySchema: categoryRankingQuerySchema },
);
