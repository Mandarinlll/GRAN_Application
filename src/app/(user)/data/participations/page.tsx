// 出場データ画面（URL: /data/participations）。
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { ParticipationView } from "@/features/data/components/participations/ParticipationView";

export default async function ParticipationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ParticipationView />;
}
