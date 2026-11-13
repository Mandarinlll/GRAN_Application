// データタブ（GRAN_Data_Tab）: navConfig の data 項目有効化ユニットテスト。
//
// ナビゲーションの "data" 項目が、マイデータ（/data/me）へ有効化
// （href="/data/me" / implemented=true）されていることを例ベースで検証する。
//
// 純粋なモジュール定数（NAV_ITEMS）の検証のためモック不要。
//
// Validates: Requirements 1.4

import { describe, it, expect } from "vitest";

import { NAV_ITEMS } from "@/components/layout/navConfig";

describe("navConfig NAV_ITEMS", () => {
  // Feature: data-tab-restructure: data 項目が /data/me へ有効化されている
  // Validates: Requirements 1.4
  it("id='data' の項目は href='/data/me' かつ implemented=true である", () => {
    const dataItem = NAV_ITEMS.find((item) => item.id === "data");

    // 項目自体が存在すること（ナビ構成から欠落していない）。
    expect(dataItem).toBeDefined();

    // 有効化の確認: /data/me へ遷移し、実装済みフラグが立っている。
    expect(dataItem?.href).toBe("/data/me");
    expect(dataItem?.implemented).toBe(true);
  });

  it("data 項目のラベルは「データ」である（既存ナビ構成を維持）", () => {
    const dataItem = NAV_ITEMS.find((item) => item.id === "data");
    expect(dataItem?.label).toBe("データ");
  });
});
