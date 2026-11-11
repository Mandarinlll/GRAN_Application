import { db } from "@/lib/db";
import { createDataRepository } from "@/features/data/server/dataRepository";
import { withDataHandler } from "@/features/data/server/handlers";
import { winRateQuerySchema } from "@/features/data/server/querySchemas";
import { aggregateByDimension } from "@/features/data/utils/aggregate";

export const dynamic = "force-dynamic";

const repo = createDataRepository(db);

export const GET = withDataHandler(
  ({ userId, query }) => {
    const buckets = aggregateByDimension(repo.getDecidedMatches(userId), query.dimension);
    const totalMatches = buckets.reduce((sum, b) => sum + b.matches, 0);
    return { dimension: query.dimension, buckets, totalMatches };
  },
  { querySchema: winRateQuerySchema },
);
