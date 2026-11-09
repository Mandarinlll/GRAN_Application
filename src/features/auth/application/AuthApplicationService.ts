// 認証ユースケースのアプリケーションサービス（oop-architecture.md §2.5）。
//
// register / login / logout を調整する。ドメインの判断（メール重複・資格照合・
// ロック/停止判定・失敗記録）を担い、戻り値として判別可能ユニオンの結果を返す。
// Next.js 固有の処理（セッション Cookie 発行・redirect）はアダプタ層（actions.ts）が担う。
// ログイン失敗はユーザー列挙防止のため、理由を区別しない汎用結果のみを返す（§4.2）。
// "use server" を持たない純 TypeScript クラスとする（テストから直接 new 可能）。

import type { DeclaredClass, Gender, UserRole } from "@/types/user";
import type { UserRepository } from "@/features/auth/domain/UserRepository";
import { GranLevelAssignmentService } from "@/features/auth/domain/GranLevelAssignmentService";

// 登録ユースケースの入力コマンド。
export interface RegisterCommand {
  email: string;
  password: string;
  realName: string;
  kanaName: string;
  nickname: string;
  gender: Gender;
  birthDate: string;
  phoneNumber: string | null;
  declaredClass: DeclaredClass;
}

// セッション発行に必要な最小の本人情報。アダプタが setSessionCookie へ渡す。
export interface AuthenticatedUser {
  id: string;
  loginId: string;
  role: UserRole;
  isAdmin: boolean;
}

// 登録結果。メール重複は正常系の分岐として判別可能ユニオンで返す。
export type RegisterOutcome =
  | { kind: "registered"; user: AuthenticatedUser }
  | { kind: "emailTaken" };

// ログイン結果。失敗理由は区別しない（列挙防止）が、ロック中・停止中のみ
// 専用の案内が必要なため分岐を保持する。
export type LoginOutcome =
  | { kind: "authenticated"; user: AuthenticatedUser }
  | { kind: "invalidCredentials" }
  | { kind: "locked" }
  | { kind: "suspended" };

// パスワードのハッシュ化・照合（bcrypt）をアダプタから注入する。
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export class AuthApplicationService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly levelAssignment: GranLevelAssignmentService = new GranLevelAssignmentService(),
  ) {}

  // ---- 新規登録 ----
  async register(cmd: RegisterCommand): Promise<RegisterOutcome> {
    // メール重複チェック。
    if (this.users.emailExists(cmd.email)) {
      return { kind: "emailTaken" };
    }

    const passwordHash = await this.passwordHasher.hash(cmd.password);
    const granLevel = this.levelAssignment.estimateInitialGranLevel(
      cmd.declaredClass,
    );

    const user = this.users.create({
      email: cmd.email,
      passwordHash,
      realName: cmd.realName,
      kanaName: cmd.kanaName,
      nickname: cmd.nickname,
      gender: cmd.gender,
      birthDate: cmd.birthDate,
      phoneNumber: cmd.phoneNumber,
      declaredClass: cmd.declaredClass,
      granLevel: granLevel.value,
    });

    return {
      kind: "registered",
      user: {
        id: user.id,
        loginId: user.loginId,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    };
  }

  // ---- ログイン ----
  async login(identifier: string, password: string): Promise<LoginOutcome> {
    const credential = this.users.findCredentialByIdentifier(identifier);
    // 存在しない場合は汎用失敗（ユーザー列挙防止）。
    if (!credential) {
      return { kind: "invalidCredentials" };
    }

    // ロック中の案内（requirements-detail-user.md 1.4）。
    if (credential.isLocked) {
      return { kind: "locked" };
    }

    // 停止アカウントの拒否。
    if (credential.status === "SUSPENDED") {
      return { kind: "suspended" };
    }

    const valid = await this.passwordHasher.verify(
      password,
      credential.passwordHash,
    );
    if (!valid) {
      this.users.registerFailedLogin(credential.id);
      return { kind: "invalidCredentials" };
    }

    // 認証成功。失敗カウントリセット。
    this.users.registerSuccessfulLogin(credential.id);
    return {
      kind: "authenticated",
      user: {
        id: credential.id,
        loginId: credential.loginId,
        role: credential.role,
        isAdmin: credential.isAdmin,
      },
    };
  }
}
