// 管理者/運営者でプレビュー中のときだけ表示する上部バー。
// 元 home.html の <div id="admin-banner"> を移植したもの。

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { ADMIN_HOME_HREF } from "@/features/admin/utils/navConfig";

// このコンポーネントが外から受け取るデータ（props）の形を型で宣言する。
type Props = {
  role: "ADMIN" | "OPERATOR"; // どちらの権限で表示中か（バッジ文言に使う）
  visible: boolean; // 表示するかどうか
};

// export function で「他ファイルから使える部品」として公開する。
export function AdminBanner({ role, visible }: Props) {
  // 早期リターン: 表示しないなら何も描かない（null を返す = 画面に出さない）。
  if (!visible) return null;

  return (
    <div className="bg-indigo-900 text-indigo-100 text-xs px-4 py-2 flex items-center justify-between shadow-inner">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-500 text-white uppercase">
          <ShieldCheck className="w-3 h-3" />
          {/* {role} のように波括弧で囲むと、JSの値(ここでは props の role)を埋め込める */}
          {role}
        </span>
        <span className="truncate">
          管理者権限でプレビュー中（ダッシュボード・大会管理権限あり）
        </span>
      </div>
      {/* 管理画面（/admin）へ戻る導線。アクセス可否は /admin 側のサーバーガードで判定する。 */}
      <Link
        href={ADMIN_HOME_HREF}
        className="shrink-0 ml-3 inline-flex items-center gap-1 px-3 min-h-[44px] -my-2 rounded font-bold text-white hover:bg-indigo-800 transition"
      >
        管理画面へ
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
