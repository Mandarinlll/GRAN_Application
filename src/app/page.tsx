// これがトップページ（URL: / ）の本体。
// App Router では「src/app/page.tsx」が自動的にトップページになる。
//
// このファイル自体は "use client" を付けていない = サーバーコンポーネント。
// 将来ここで「DBから大会を取ってくる」処理を書ける（今は固定データを import するだけ）。

import { AdminBanner } from "@/components/home/AdminBanner";
import { AppHeader } from "@/components/home/AppHeader";
import { RequiredActionCard } from "@/components/home/RequiredActionCard";
import { EnteredTournamentsCarousel } from "@/components/home/EnteredTournamentsCarousel";
import { BottomNav } from "@/components/home/BottomNav";
import { AlertCircle } from "lucide-react";

// 固定データを読み込む。将来はこの3行が「DBへの問い合わせ」に置き換わる。
import {
  currentUser,
  requiredActions,
  enteredTournaments,
} from "@/data/homeData";

export default function HomePage() {
  return (
    <>
      {/* 管理者バナー（isAdminPreview が true のときだけ中身が出る） */}
      <AdminBanner
        role={currentUser.role === "OPERATOR" ? "OPERATOR" : "ADMIN"}
        visible={currentUser.isAdminPreview}
      />

      {/* ヘッダー。user という props でログイン中ユーザーを渡す */}
      <AppHeader user={currentUser} />

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 要対応セクション */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>要対応</span>
          </h3>

          {/* requiredActions（配列）を1件ずつカードに変換して並べる。
              key は React が「どの要素か」を見分けるための目印。必ず一意の値を渡す。 */}
          {requiredActions.map((action) => (
            <RequiredActionCard key={action.id} action={action} />
          ))}
        </section>

        {/* エントリー済み大会セクション（見出し・ページ表示はカルーセル側が持つ） */}
        <section>
          <EnteredTournamentsCarousel tournaments={enteredTournaments} />
        </section>
      </main>

      {/* 下部固定ナビ */}
      <BottomNav />
    </>
  );
}
