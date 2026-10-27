// データタブ（GRAN_Data_Tab）: /data ページの認証ガードユニットテスト。
//
// Task 6.3 の一部。セッションが無い（未認証）状態で /data ページを実行すると、
// ログイン画面（"/login"）へリダイレクトすることを例ベースで検証する。
//
// ガード方針（page.tsx）:
//   const session = await getSession();
//   if (!session) redirect("/login");
// このため getSession が null を返す経路では、redirect("/login") が呼ばれ、
// 以降のビューモデル組み立て（buildDataViewData → DB アクセス）には到達しない。
//
// テストはハーメティックに保つ:
//   - "@/lib/session" をモックし getSession を null 解決にする（未認証を再現）。
//   - "next/navigation" をモックし redirect が番兵例外を投げて以降の実行を止める
//     （実際の Next.js redirect も内部的に例外を投げて制御を中断する挙動に倣う）。
//   - 共有 SQLite（data/gran.db）に触れないよう、ページが import する DB 依存
//     モジュール（buildDataViewData / getCurrentUser）と React コンポーネント
//     （AppShell / DataTabView）をモックし、import 時点の副作用を遮断する。
//     未認証経路では redirect で早期中断するため、これらは呼ばれない。
//
// Validates: Requirements 1.6（未認証はログイン画面へリダイレクト）

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- モック定義 ----------------------------------------------------------

// セッション: 既定は「未認証（null）」。各テストで必要に応じて上書きする。
const getSessionMock = vi.fn();
vi.mock("@/lib/session", () => ({
  getSession: () => getSessionMock(),
}));

// next/navigation.redirect: 呼び出し引数を記録しつつ、実行を止める番兵例外を投げる。
// 実際の Next.js redirect も例外を throw して後続処理を中断するため、同じ形に倣う。
class RedirectSentinel extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
    this.name = "RedirectSentinel";
  }
}
const redirectMock = vi.fn((to: string) => {
  throw new RedirectSentinel(to);
});
vi.mock("next/navigation", () => ({
  redirect: (to: string) => redirectMock(to),
}));

// DB に触れる依存・React コンポーネントは import 時副作用を避けるためスタブ化する。
// 未認証経路では redirect で早期 return するため、これらは本テストでは呼ばれない。
const getCurrentUserMock = vi.fn();
vi.mock("@/features/auth/server/currentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));
const buildDataViewDataMock = vi.fn();
vi.mock("@/features/data/server/dataViewData", () => ({
  buildDataViewData: (...args: unknown[]) => buildDataViewDataMock(...args),
}));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: () => null,
}));
vi.mock("@/features/data/components/DataTabView", () => ({
  DataTabView: () => null,
}));

// モック設定後に対象（default export の Server Component 関数）を import する。
import DataPage from "@/app/(user)/data/page";

describe("/data ページ 認証ガード", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Feature: data-tab, Task 6.3: 未認証は /login へリダイレクト
  // Validates: Requirements 1.6
  it("セッションが無い（null）とき redirect('/login') を呼ぶ", async () => {
    getSessionMock.mockResolvedValue(null);

    // redirect は番兵例外を投げるため、ページ実行は reject する。
    await expect(DataPage()).rejects.toBeInstanceOf(RedirectSentinel);

    // "/login" へ、ちょうど 1 回リダイレクトした。
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("未認証経路では DB 依存のビューモデル組み立てに到達しない", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(DataPage()).rejects.toBeInstanceOf(RedirectSentinel);

    // redirect で早期中断するため、getCurrentUser / buildDataViewData は呼ばれない。
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(buildDataViewDataMock).not.toHaveBeenCalled();
  });
});
