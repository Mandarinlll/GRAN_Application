// 共通ステータスラベル（単一の真実の源）と共通バッジの描画テスト（FEAT-004）。
//
// panels.branches.test.tsx と同様、jsdom を使わず react-dom/server の
// renderToStaticMarkup で静的 HTML へ描画し、文言・トークンクラスを検証する
// （vitest.config.ts は environment: "node"）。
//
// 検証対象:
//   - statusLabels.ts のラベル Record がドメインリテラル型を網羅している（例ベース）
//   - CapacityBadge / EntryKindBadge が単一の真実の源の文言とセマンティックトークンで描画される

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  CapacityBadge,
  EntryKindBadge,
  StatusBadge,
} from "@/components/ui/StatusBadge";
import {
  CAPACITY_STATUS_LABEL,
  ENTRY_KIND_LABEL,
  ENTRY_STATUS_LABEL,
  WAITLIST_STATUS_LABEL,
  type EntryKind,
} from "@/components/ui/statusLabels";
import type { CapacityStatus } from "@/features/tournaments/utils/capacity";
import type {
  EntryStatus,
  WaitlistStatus,
} from "@/features/entries/types/entry";

function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("statusLabels（単一の真実の源）", () => {
  it("CAPACITY_STATUS_LABEL は規約 §4.3 の正規ラベルと一致する", () => {
    const expected: Record<CapacityStatus, string> = {
      OPEN: "空き枠あり",
      FEW: "残りわずか",
      FULL: "満員 (キャンセル待ち)",
    };
    expect(CAPACITY_STATUS_LABEL).toStrictEqual(expected);
  });

  it("ENTRY_KIND_LABEL は 4 種別すべてにラベルを持つ（網羅）", () => {
    const kinds: EntryKind[] = [
      "CONFIRMED",
      "WAITING",
      "CANCELLED",
      "ATTENDED",
    ];
    for (const kind of kinds) {
      expect(ENTRY_KIND_LABEL[kind]).toBeTruthy();
    }
    expect(ENTRY_KIND_LABEL.CONFIRMED).toBe("確定");
    expect(ENTRY_KIND_LABEL.CANCELLED).toBe("キャンセル済");
  });

  it("ENTRY_STATUS_LABEL は entry_status_enum の全値を網羅する", () => {
    const statuses: EntryStatus[] = [
      "CONFIRMED",
      "WAITING",
      "CANCELLED",
      "ATTENDED",
    ];
    for (const status of statuses) {
      expect(ENTRY_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("WAITLIST_STATUS_LABEL は waitlist_status_enum の全値を網羅する", () => {
    const statuses: WaitlistStatus[] = [
      "WAITING",
      "OFFERED",
      "ACCEPTED",
      "DECLINED",
      "EXPIRED",
    ];
    for (const status of statuses) {
      expect(WAITLIST_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});

describe("CapacityBadge", () => {
  it("OPEN は単一の真実の源のラベルと emerald トークンで描画する", () => {
    const html = render(<CapacityBadge status="OPEN" />);
    expect(html).toContain(CAPACITY_STATUS_LABEL.OPEN);
    expect(html).toContain("text-emerald-700");
  });

  it("FEW は残りわずか + amber トークンで描画する", () => {
    const html = render(<CapacityBadge status="FEW" />);
    expect(html).toContain(CAPACITY_STATUS_LABEL.FEW);
    expect(html).toContain("text-amber-700");
  });

  it("FULL は満員 (キャンセル待ち) + rose トークンで描画する", () => {
    const html = render(<CapacityBadge status="FULL" />);
    expect(html).toContain(CAPACITY_STATUS_LABEL.FULL);
    expect(html).toContain("text-rose-700");
  });
});

describe("EntryKindBadge", () => {
  it("CONFIRMED は「確定」+ emerald トークンで描画する", () => {
    const html = render(<EntryKindBadge kind="CONFIRMED" />);
    expect(html).toContain("確定");
    expect(html).toContain("text-emerald-700");
  });

  it("children を渡すと既定ラベルの代わりにその内容を描画する", () => {
    const html = render(<EntryKindBadge kind="WAITING">#3</EntryKindBadge>);
    expect(html).toContain("#3");
    expect(html).not.toContain(ENTRY_KIND_LABEL.WAITING);
  });
});

describe("StatusBadge（汎用）", () => {
  it("neutral トーンは slate トークンで描画する", () => {
    const html = render(<StatusBadge tone="neutral">終了</StatusBadge>);
    expect(html).toContain("終了");
    expect(html).toContain("text-slate-600");
  });
});
