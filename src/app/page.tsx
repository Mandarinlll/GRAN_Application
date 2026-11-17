// トップ（URL: /）。ホーム画面は /home へ移動したため、既存のリンク・ブックマーク用にリダイレクトする。
import { redirect } from "next/navigation";
import { HOME_HREF } from "@/components/layout/navConfig";

export default function RootPage() {
  redirect(HOME_HREF);
}
