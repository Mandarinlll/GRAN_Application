import { redirect } from "next/navigation";

// /data はマイデータへ遷移する。
export default function DataIndexPage() {
  redirect("/data/me");
}
