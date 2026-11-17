// トピックス管理（URL: /admin/topics）。ADMIN / OPERATOR のみ。
import { requireAdminPage } from "@/features/admin/server/guard";
import { listAllTopics } from "@/features/topics/server/topicAdminRepository";
import { TopicsManager } from "@/features/topics/components/TopicsManager";

export default async function AdminTopicsPage() {
  await requireAdminPage("topics.manage");
  return <TopicsManager topics={listAllTopics()} />;
}
