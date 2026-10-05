// トップページ（URL: / ）= ログイン後のホーム画面。
// App Router では「src/app/page.tsx」が自動的にトップページになる。
//
// このファイルはサーバーコンポーネント。ここでセッションを検証し、
// ログイン中ユーザーを DB から取得する。未ログインなら /login へ誘導する。

import { redirect } from "next/navigation";
import { AdminBanner } from "@/components/home/AdminBanner";
import { AppHeader } from "@/components/home/AppHeader";
import { RequiredActionCard } from "@/components/home/RequiredActionCard";
import { EnteredTournamentsCarousel } from "@/components/home/EnteredTournamentsCarousel";
import { BottomNav } from "@/components/home/BottomNav";
import { Sidebar } from "@/components/home/Sidebar";
import { AlertCircle, CalendarX } from "lucide-react";
import { getCurrentUser } from "@/features/auth/server/currentUser";

// 大会・エントリー機能は本タスクの対象外のため、表示用データは固定のまま読み込む。
// 実ユーザーのエントリー履歴が実装されるまでの暫定表示。
import { requiredActions, enteredTournaments } from "@/data/homeData";

export default async function HomePage() {
  // セッション検証。未ログインならログイン画面へ。
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  return (
    <>
      {/* PC（640px以上）で常時表示する左側固定サイドバー */}
      <Sidebar user={currentUser} />

      {/* サイドバー分の左余白を 640px 以上で確保するラッパー。
          モバイルでは余白なし（サイドバー非表示）。 */}
      <div className="sm:pl-60">
        {/* 管理者バナー（管理者/運営者のときだけ表示） */}
        <AdminBanner
          role={currentUser.role === "OPERATOR" ? "OPERATOR" : "ADMIN"}
          visible={currentUser.isAdminPreview}
        />

        {/* ヘッダー（モバイル専用。640px以上ではサイドバーが担う） */}
        <AppHeader user={currentUser} />

        {/* メインコンテンツ */}
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 要対応セクション */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>要対応</span>
          </h3>

          {requiredActions.length > 0 ? (
            requiredActions.map((action) => (
              <RequiredActionCard key={action.id} action={action} />
            ))
          ) : (
            <EmptyState message="対応が必要な項目はありません。" />
          )}
        </section>

        {/* エントリー済み大会セクション */}
        <section>
          {enteredTournaments.length > 0 ? (
            <EnteredTournamentsCarousel tournaments={enteredTournaments} />
          ) : (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-3">
                エントリー済みの大会
              </h3>
              <EmptyState message="まだエントリー済みの大会はありません。" />
            </>
          )}
        </section>
        </main>
      </div>

      {/* 下部固定ナビ（モバイル専用。640px以上ではサイドバーが担う） */}
      <BottomNav />
    </>
  );
}

// エントリーや要対応が空のときに表示する簡易プレースホルダー。
function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-2 shadow-sm">
      <CalendarX className="w-8 h-8 text-slate-300" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
