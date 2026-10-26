// 大会日程ページ（クライアントコンポーネント）へ渡す表示用 DTO。
// Server Component で算出し、プレーンオブジェクトとして props で渡す。

import type {
  TournamentCategory,
  TournamentStatus,
  TournamentTier,
} from "@/features/tournaments/types/tournament";
import type { CapacityStatus } from "@/features/tournaments/utils/capacity";

export interface TournamentCardData {
  id: string;
  title: string;
  category: TournamentCategory;
  tier: TournamentTier;
  eventDate: string; // YYYY-MM-DD
  eventDateLabel: string; // 2026/10/19 (日)
  month: number; // 1-12
  startTime: string; // HH:MM
  endTime: string | null;
  venue: string;
  courtInfo: string | null;
  description: string | null;
  imageUrl: string | null;
  capacity: number;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  entryFee: number;
  entryFeeLabel: string; // ¥20,000
  status: TournamentStatus;
  entryStartAt: string;
  entryEndAt: string;
  // 集計・派生値
  confirmedCount: number;
  waitingCount: number;
  remaining: number;
  capacityStatus: CapacityStatus;
  // ビューア用
  isPast: boolean;
  isEntered: boolean; // ログインユーザー/チームが申込中か
}
