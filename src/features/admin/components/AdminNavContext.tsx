// 管理者・運営者がユーザー画面を開いているときに、AppShell へ管理者用ナビの表示項目を渡すコンテキスト。
// 値は (user) レイアウトがサーバー側で DB の最新ロールから決める。null なら一般ユーザー（従来のナビ）。
// あくまで表示の切替で、各画面・API の認可はサーバー側のガードで行う。
"use client";

import { createContext, useContext } from "react";

const AdminNavContext = createContext<string[] | null>(null);

export function AdminNavProvider({
  allowedIds,
  children,
}: {
  allowedIds: string[] | null;
  children: React.ReactNode;
}) {
  return <AdminNavContext.Provider value={allowedIds}>{children}</AdminNavContext.Provider>;
}

// 管理者用ナビで表示してよい項目の id。一般ユーザーなら null。
export function useAdminNav(): string[] | null {
  return useContext(AdminNavContext);
}
