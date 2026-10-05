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
