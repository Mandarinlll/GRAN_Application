// 旧トピックス管理の URL。通知管理のトピックスタブへ移動した。
import { redirect } from "next/navigation";

export default function AdminTopicsPage() {
  redirect("/admin/notifications?tab=topics");
}