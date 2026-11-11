import { db } from "@/lib/db";
import { createDataRepository } from "@/features/data/server/dataRepository";
import { withDataHandler } from "@/features/data/server/handlers";

export const dynamic = "force-dynamic";

const repo = createDataRepository(db);

export const GET = withDataHandler(({ userId }) => repo.getLevel(userId));
