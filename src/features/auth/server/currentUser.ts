// セッションからログイン中ユーザーを解決し、ホーム画面用のビューモデルへ変換する薄いアダプタ。
//
// OOP 化（oop-architecture.md §5）に伴い、解決・変換ロジックは
// auth/application/CurrentUserService へ移設した。本モジュールは Next.js 固有の
// セッション取得（getSession）のみを担い、コンポジションルート（container.ts）から
// サービスを組み立てて委譲する。getCurrentUser の外部契約（シグネチャ・戻り値）は不変。

import { getSession } from "@/lib/session";
import { createCurrentUserService } from "@/server/container";
import type { CurrentUser } from "@/types/home";

// 現在のログインユーザーを取得する。未ログイン/不整合時は null。
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  return createCurrentUserService().getCurrentUser(session);
}
