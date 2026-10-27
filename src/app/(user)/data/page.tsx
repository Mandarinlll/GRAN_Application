// データタブ トップページ（URL: /data）。
// サーバーコンポーネント。セッション検証 → 閲覧ユーザー解決 → ビューモデル組み立て
// を行い、クライアントコンポーネント（DataTabView）へ初期データを渡す。
//
// 認証ガードは既存の tournaments/page.tsx のパターンを踏襲する。
// ただし buildDataViewData は tournament_results を user_id=users.id（UUID）で
// 絞り込むため、loginId しか持たない CurrentUser とは別に UUID が必要になる。
// UUID はセッション（session.sub）から取得する（currentUser.ts と同じ経路）。
//
// _Requirements: 1.1, 1.6_

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { buildDataViewData } from "@/features/data/server/dataViewData";
import { AppShell } from "@/components/layout/AppShell";
import { DataTabView } from "@/features/data/components/DataTabView";

export default async function DataPage() {
  // ログイン必須。セッション（UUID=session.sub を保持）が無ければログイン画面へ。
  const session = await getSession();
  if (!session) redirect("/login");

  // 閲覧ユーザーのビューモデル。整合しなければ（ユーザー不在など）ログイン画面へ。
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  // データタブ全体の初期ビューモデルを組み立てる。
  // tournament_results は users.id（UUID=session.sub）で絞り込むため viewerId に渡す。
  const data = buildDataViewData(viewer, session.sub);

  // AppShell に渡す共通ユーザー情報へ変換する（home/schedule と同形式）。
  const shellUser = {
    realName: viewer.realName,
    nickname: viewer.nickname,
    granLevel: viewer.granLevel,
    avatarText: viewer.avatarText,
    teamName: viewer.teamName || null,
  };

  return (
    <AppShell activeId="data" user={shellUser}>
      <DataTabView data={data} />
    </AppShell>
  );
}
