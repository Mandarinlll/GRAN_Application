// アプリ全体で共有するユーザー関連の型定義。
// DB ENUM と同期したリテラル型（コーディング規約 3.3 準拠）。

// 権限区分（4段階ロール）
export type UserRole = "ADMIN" | "OPERATOR" | "LEADER" | "USER";

// アカウント状態
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "PROVISIONAL";

// 性別
export type Gender = "MALE" | "FEMALE" | "OTHER";

// 自己申告階級（register 仕様: A→AB→B→BC→C→CD→D→DE の8段階）
export type DeclaredClass = "A" | "AB" | "B" | "BC" | "C" | "CD" | "D" | "DE";

// users テーブル1行に対応するアプリ内部表現。
// （password_hash はクライアントへ絶対に露出させないため User には含めない）
export interface User {
  id: string;
  loginId: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
  status: AccountStatus;
  isInitialLogin: boolean;
  realName: string;
  kanaName: string;
  nickname: string;
  avatarUrl: string | null;
  gender: Gender | null;
  birthDate: string | null;
  phoneNumber: string | null;
  declaredClass: DeclaredClass | null;
  granLevel: number;
  isLevelCalibrated: boolean;
  ratedMatchCount: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// JWT に載せる最小限のセッション情報。
export interface SessionPayload {
  sub: string; // users.id
  loginId: string;
  role: UserRole;
  isAdmin: boolean;
}
