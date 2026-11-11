import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// 大会側の部門（tournaments.gender_division）。NULL = 未設定
export type GenderDivision = "MEN" | "WOMEN" | "MIXED";

// ランキング側の種目（ユーザーの性別区分）
export type RankingCategory = "MEN" | "WOMEN" | "MIXED";

// tournaments.surface
export type Surface = "HARD" | "CLAY" | "ARTIFICIAL_GRASS" | "OTHER";

// tournament_results の結果区分
export type ResultRank =
  | "PARTICIPATED"
  | "L2_WINNER"
  | "T1_RUNNER_UP"
  | "T1_WINNER";

export interface PromotionNextDto {
  tier: TournamentTier;
  threshold: number;
  pointsToGo: number;
  progressPercent: number;
}

export interface LevelDto {
  granLevel: number;
  isCalibrated: boolean;
  tier: TournamentTier;
  next: PromotionNextDto | null;
}

export interface HistoryRowDto {
  id: string;
  recordedAt: string;
  tournamentTitle: string;
  preLevel: number;
  diff: number;
  postLevel: number;
}

export interface ChartPointDto {
  recordedAt: string;
  tournamentTitle: string;
  postLevel: number;
}

export interface RecentMatchDto {
  matchId: string;
  eventDate: string;
  tournamentTitle: string;
  opponent: string;
  result: "WIN" | "LOSS";
  score: string | null;
}

export interface ParticipationRowDto {
  tournamentId: string;
  title: string;
  eventDate: string;
  venue: string;
  category: TournamentCategory;
  genderDivision: GenderDivision | null;
  tier: TournamentTier;
  result: ResultRank | null;
}

export interface ParticipationDetailDto extends ParticipationRowDto {
  matches: Array<{
    round: number;
    opponent: string;
    score: string | null;
    outcome: "WIN" | "LOSS" | "DRAW" | "UNDECIDED";
  }>;
  granChange: { pre: number; diff: number; post: number } | null; // null = 未確定
  isResultConfirmed: boolean;
}

// ランキングに載せる他ユーザー情報は限定項目のみ（要件8.8, 11.4）。
// userId はサーバー内部の整列用で、クライアント返却時には除去する。
export interface RankingRowDto {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  granLevel: number;
  tier: TournamentTier;
  isMe: boolean;
}
