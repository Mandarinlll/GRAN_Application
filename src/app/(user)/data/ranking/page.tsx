// ランキング画面（URL: /data/ranking）。
// layout.tsx は画面遷移で再実行されないため、ページ側でも認証チェックを行う。
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { granLevelToTier } from "@/features/auth/utils/classLabel";
import { RankingView } from "@/components/ranking/RankingView";

export default async function RankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 現在の階級を判定できない場合（レベル不正）は null を渡し、A を初期選択にする（要件8.14）。
  const currentTier = Number.isFinite(user.granLevel) ? granLevelToTier(user.granLevel) : null;

  return <RankingView initialTier={currentTier} />;
}
