// 大会の空き枠ステータス算出（requirements-detail-user.md 2.1 準拠）。
//
// OOP 化（oop-architecture.md §2.1 / §5）に伴い、残枠・充足ステータスの算出は
// Tournament エンティティ（remaining / capacityStatus）へ吸収した。CapacityStatus 型も
// エンティティ側に一本化し、ここから re-export する。本モジュールは、まだ移行していない
// 呼び出し元（view.ts / CapacityMeter.tsx の型参照）を壊さないための薄い委譲ラッパとして残置する。

import { Tournament } from "@/features/tournaments/domain/Tournament";
export type { CapacityStatus } from "@/features/tournaments/domain/Tournament";

// 空き状況の算出に用いる、capacity / status だけを持つ最小エンティティを生成する補助。
// remaining / capacityStatus は capacity と confirmedCount のみに依存する。
function capacityOnly(capacity: number): Tournament {
  return new Tournament({
    id: "",
    title: "",
    category: "SINGLES",
    tier: "A",
    eventDate: "",
    startTime: "",
    endTime: null,
    venue: "",
    courtInfo: null,
    imageUrl: null,
    description: null,
    capacity,
    teamSizeMin: null,
    teamSizeMax: null,
    entryFee: 0,
    status: "OPEN",
    entryStartAt: "",
    entryEndAt: "",
    copyFromId: null,
    alertThreshold: null,
    drawPdfUrl: null,
    createdAt: "",
    updatedAt: "",
  });
}

// 残り枠数を算出する（0未満は0に丸める）。
export function calcRemaining(capacity: number, confirmedCount: number): number {
  return capacityOnly(capacity).remaining(confirmedCount);
}

// 充足状況から派生ステータスを算出する。
export function calcCapacityStatus(
  capacity: number,
  confirmedCount: number,
): import("@/features/tournaments/domain/Tournament").CapacityStatus {
  return capacityOnly(capacity).capacityStatus(confirmedCount);
}
