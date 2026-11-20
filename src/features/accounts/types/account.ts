// ユーザー・チーム管理の型。パスワードハッシュに相当するプロパティは持たない。
import type { AccountStatus, DeclaredClass, Gender, UserRole } from "@/types/user";

export type ErrorCode =
  | "UNAUTHENTICATED" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  | "VALIDATION" // 400
  | "CONFLICT" // 409
  | "INTERNAL"; // 500

export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      reason?: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export interface UserListRow {
  id: string;
  loginId: string;
  realName: string;
  nickname: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  granLevel: number;
  declaredClass: DeclaredClass | null;
  locked: boolean;
  isLevelCalibrated: boolean;
}

export interface UserTeamSummary {
  id: string;
  name: string;
  leaderNickname: string;
  isLeader: boolean;
}

export interface AdminLogRow {
  id: string;
  action: string;
  operatorLoginId: string;
  detail: string | null;
  createdAt: string;
}

export interface UserDetail {
  id: string;
  loginId: string;
  realName: string;
  kanaName: string | null;
  nickname: string;
  email: string;
  gender: Gender | null;
  birthDate: string | null;
  phoneNumber: string | null;
  role: UserRole;
  status: AccountStatus;
  granLevel: number;
  declaredClass: DeclaredClass | null;
  isLevelCalibrated: boolean;
  locked: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  ledTeam: UserTeamSummary | null;
  teams: UserTeamSummary[];
  activePersonalEntryCount: number;
  logs: AdminLogRow[];
}

export interface TeamListRow {
  id: string;
  name: string;
  leaderUserId: string;
  leaderRealName: string;
  leaderNickname: string;
  memberCount: number;
  activeEntryCount: number;
  createdAt: string;
}

export interface TeamMemberRow {
  userId: string;
  loginId: string;
  realName: string;
  nickname: string;
  granLevel: number;
  isLeader: boolean;
  joinedAt: string | null;
}

export interface TeamActiveEntryRow {
  entryId: string;
  tournamentId: string;
  tournamentName: string;
  eventDate: string;
  status: "CONFIRMED" | "WAITING";
}

export interface TeamPendingInvitationRow {
  id: string;
  inviteeNickname: string;
  createdAt: string;
}

export interface TeamDetail {
  id: string;
  name: string;
  avatarKey: string | null;
  leaderUserId: string;
  leaderRealName: string;
  leaderNickname: string;
  createdAt: string;
  members: TeamMemberRow[];
  activeEntries: TeamActiveEntryRow[];
  pendingInvitations: TeamPendingInvitationRow[];
}

export interface CreateUserInput {
  email: string;
  realName: string;
  kanaName: string;
  nickname: string;
  gender: Gender | null;
  birthDate: string | null;
  phoneNumber: string;
  declaredClass: DeclaredClass;
  granLevel: number | null;
  role: UserRole;
}
