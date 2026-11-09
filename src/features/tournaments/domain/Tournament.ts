// 大会（tournaments）エンティティ（oop-architecture.md §2.1 / §5）。
//
// 同一性（id）を持つリッチドメインモデル。現行 tournaments/utils/capacity.ts の
// calcRemaining / calcCapacityStatus を remaining(confirmedCount) / capacityStatus(confirmedCount)
// として吸収し、受付中判定 isOpen() と受け入れ可否 canAcceptEntry(confirmedCount) を持つ。
//
// 重要（§2.1 境界ルール）: これらは「ドメイン内の算出手段」にすぎない。Server Action・
// ビューの戻り値（TournamentWithStats / TournamentCardData）は現行どおり remaining:number /
// capacityStatus:"OPEN"|"FEW"|"FULL" のプレーンフィールドを維持し、エンティティ/メソッドを
// "use server" 境界・Client Component へ渡さない（変換はクエリサービス/リポジトリが行う）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type {
  TournamentCategory,
  TournamentStatus,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// 空き状況の派生ステータス（残枠ゼロ=FULL / 75%以上=FEW / それ以外=OPEN）。
export type CapacityStatus = "OPEN" | "FEW" | "FULL";

// エンティティ生成に必要な属性（永続化行から rehydrate する素材）。
export interface TournamentProps {
  id: string;
  title: string;
  category: TournamentCategory;
  tier: TournamentTier;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  venue: string;
  courtInfo: string | null;
  imageUrl: string | null;
  description: string | null;
  capacity: number;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  entryFee: number;
  status: TournamentStatus;
  entryStartAt: string;
  entryEndAt: string;
  copyFromId: string | null;
  alertThreshold: number | null;
  drawPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export class Tournament {
  readonly id: string;
  readonly title: string;
  readonly category: TournamentCategory;
  readonly tier: TournamentTier;
  readonly eventDate: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly venue: string;
  readonly courtInfo: string | null;
  readonly imageUrl: string | null;
  readonly description: string | null;
  readonly capacity: number;
  readonly teamSizeMin: number | null;
  readonly teamSizeMax: number | null;
  readonly entryFee: number;
  readonly status: TournamentStatus;
  readonly entryStartAt: string;
  readonly entryEndAt: string;
  readonly copyFromId: string | null;
  readonly alertThreshold: number | null;
  readonly drawPdfUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: TournamentProps) {
    this.id = props.id;
    this.title = props.title;
    this.category = props.category;
    this.tier = props.tier;
    this.eventDate = props.eventDate;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.venue = props.venue;
    this.courtInfo = props.courtInfo;
    this.imageUrl = props.imageUrl;
    this.description = props.description;
    this.capacity = props.capacity;
    this.teamSizeMin = props.teamSizeMin;
    this.teamSizeMax = props.teamSizeMax;
    this.entryFee = props.entryFee;
    this.status = props.status;
    this.entryStartAt = props.entryStartAt;
    this.entryEndAt = props.entryEndAt;
    this.copyFromId = props.copyFromId;
    this.alertThreshold = props.alertThreshold;
    this.drawPdfUrl = props.drawPdfUrl;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  // 受付中（status === "OPEN"）か。
  isOpen(): boolean {
    return this.status === "OPEN";
  }

  // 残り枠数を算出する（0未満は0に丸める）。現行 calcRemaining を吸収。
  remaining(confirmedCount: number): number {
    return Math.max(0, this.capacity - confirmedCount);
  }

  // 充足状況から派生ステータスを算出する。現行 calcCapacityStatus を吸収。
  // 「75%以上で残りわずか」= 確定数 / 定員 >= 0.75。
  capacityStatus(confirmedCount: number): CapacityStatus {
    if (this.capacity <= 0) return "FULL";
    const remaining = this.remaining(confirmedCount);
    if (remaining <= 0) return "FULL";
    const ratio = confirmedCount / this.capacity;
    if (ratio >= 0.75) return "FEW";
    return "OPEN";
  }

  // 確定数を踏まえてまだ受け入れ可能か（confirmedCount < capacity）。TOCTOU 再チェックに使う。
  canAcceptEntry(confirmedCount: number): boolean {
    return confirmedCount < this.capacity;
  }
}
