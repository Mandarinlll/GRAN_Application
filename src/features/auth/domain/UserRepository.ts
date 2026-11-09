// users テーブルの永続化抽象（oop-architecture.md §2.4）。
//
// インターフェースをドメイン層に、実装（SqliteUserRepository）をインフラ層に置く（依存性逆転）。
// 現行 auth/server/userRepository.ts の公開関数を 1:1 で写像する。
// DB 行型（UserRow）や SQL はインフラ実装の内部に隠蔽する。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { AccountStatus, User, UserRole } from "@/types/user";

// 新規ユーザー作成に必要な入力（現行 CreateUserParams と 1:1）。
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  realName: string;
  kanaName: string;
  nickname: string;
  gender: User["gender"];
  birthDate: string;
  phoneNumber: string | null;
  declaredClass: NonNullable<User["declaredClass"]>;
  granLevel: number;
}

// 認証（ログイン）に必要な資格情報。現行 UserRow の照合に使う部分のみを
// ドメイン型として公開し、DB 行の全カラム（snake_case）は隠蔽する。
export interface UserCredential {
  id: string;
  loginId: string;
  role: UserRole;
  isAdmin: boolean;
  status: AccountStatus;
  passwordHash: string;
  // ロック中か（locked_until が未来か）をインフラ側で判定済みで渡す。
  isLocked: boolean;
}

export interface UserRepository {
  // メールアドレスが既に登録済みか。
  emailExists(email: string): boolean;
  // ユーザーを新規作成して作成後の User を返す。
  create(input: CreateUserInput): User;
  // 認証用に資格情報を1件取得する（ログインID または メール）。無ければ null。
  findCredentialByIdentifier(identifier: string): UserCredential | null;
  // id から User を1件取得する（セッション復元用、password_hash は返さない）。
  findById(id: string): User | null;
  // ログイン失敗を記録し、上限到達でロックする。
  registerFailedLogin(id: string): void;
  // ログイン成功時に失敗カウントをリセットし最終ログイン日時を更新する。
  registerSuccessfulLogin(id: string): void;
}
