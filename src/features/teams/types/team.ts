// チーム（teams / team_members）ドメインの型定義。
// db-schema.md 3.2 / 3.3 準拠。

// teams テーブル1行に対応するアプリ内部表現。
export interface Team {
  id: string;
  name: string;
  avatarUrl: string | null;
  leaderUserId: string;
  createdAt: string;
  updatedAt: string;
}

// team_members テーブル1行に対応するアプリ内部表現。
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
}

// エントリー画面などで使う「チーム + メンバーの表示情報」。
export interface TeamMemberView {
  userId: string;
  realName: string;
  nickname: string;
  granLevel: number;
  isLeader: boolean;
}

// チームとその所属メンバーをまとめたビューモデル。
export interface TeamWithMembers {
  team: Team;
  leaderName: string;
  members: TeamMemberView[];
}

// --- チームページ（一覧・詳細・招待） ---

import type {
  TournamentCategory,
  TournamentTier,
} from "@/features/tournaments/types/tournament";

// チーム一覧の1行。種目は出場履歴（entries）、階級は所属メンバーの平均GRANレベルから導出する。
export interface TeamListItem {
  id: string;
  name: string;
  leaderUserId: string;
  avatarKey: string | null;
  leaderNickname: string;
  memberCount: number;
  categories: TournamentCategory[];
  tier: TournamentTier | null; // メンバー0人のとき null
  averageGranLevel: number | null;
}

// 成績サマリー（tournament_results.team_id 集計）。
export interface TeamRecord {
  participations: number;
  titles: number; // T1_WINNER
  runnerUps: number; // T1_RUNNER_UP
  l2Titles: number; // L2_WINNER
}

export interface TeamResultRow {
  tournamentId: string;
  title: string;
  eventDate: string;
  rankType: "PARTICIPATED" | "L2_WINNER" | "T1_RUNNER_UP" | "T1_WINNER";
}

export interface TeamDetail {
  id: string;
  name: string;
  leaderUserId: string;
  avatarKey: string | null;
  leaderNickname: string;
  createdAt: string;
  categories: TournamentCategory[];
  tier: TournamentTier | null;
  averageGranLevel: number | null;
  members: Array<{
    userId: string;
    nickname: string;
    granLevel: number;
    isLeader: boolean;
  }>;
  record: TeamRecord;
  recentResults: TeamResultRow[];
}

// 代表者が見る「招待中」ユーザー。
export interface InvitationView {
  id: string;
  userId: string;
  nickname: string;
  granLevel: number;
  createdAt: string;
}

// 招待先として検索された候補ユーザー。
export interface InviteCandidate {
  userId: string;
  nickname: string;
  granLevel: number;
}