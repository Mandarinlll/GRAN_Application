// マイデータ（/data/me）。レイアウトに加え、ページ側でも認証を確認する。
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { GranHistory } from "@/features/data/components/me/GranHistory";
import { LevelCard } from "@/features/data/components/me/LevelCard";
import { RecordSummary } from "@/features/data/components/me/RecordSummary";
import { WinRateByCondition } from "@/features/data/components/me/WinRateByCondition";

export default async function MyDataPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <LevelCard />
      <GranHistory />
      <RecordSummary />
      <WinRateByCondition />
    </div>
  );
}
