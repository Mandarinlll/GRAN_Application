// ランキング画面（URL: /data/ranking）。
// layout.tsx は画面遷移で再実行されないため、ページ側でも認証チェックを行う。
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { granLevelToTier } from "@/features/auth/utils/classLabel";
import { RankingView } from "@/components/ranking/RankingView";

export default async function RankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <RankingView initialTier={granLevelToTier(user.granLevel)} />;
}
