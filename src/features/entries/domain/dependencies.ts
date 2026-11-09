// entries パイロットが必要とする他 feature の最小依存インターフェース
// （oop-architecture.md §7 / §8・FEAT-002 ステップ7）。
//
// 他 feature（tournaments / teams / auth / notifications）の本格的な OOP 化は後続 FEAT で行う。
// パイロットでは「entries が必要とする最小の interface」だけをここに定義し、
// 具体 Sqlite 実装はコンポジションルート（container.ts）が既存の公開リポジトリ関数の上に配線する。
// 配線以外の feature 内部実装には触れない（§8 クロスインポート健全化）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { TournamentCategory } from "@/features/tournaments/types/tournament";

// entries が参照する大会のドメインビュー。tournaments の OOP 化（FEAT-003）までの
// 最小表現であり、受付可否・定員充足の派生判定を振る舞いとして持つ。
export interface TournamentView {
  readonly id: string;
  readonly title: string;
  readonly category: TournamentCategory;
  readonly eventDate: string;
  readonly entryFee: number;
  readonly teamSizeMin: number | null;
  readonly teamSizeMax: number | null;
  // 受付中（status === "OPEN"）か。
  isOpen(): boolean;
  // 確定数から残枠を算出する（0未満は0）。事前満員判定に使う。
  remaining(confirmedCount: number): number;
  // 確定数を踏まえてまだ受け入れ可能か（confirmedCount < capacity）。TOCTOU 再チェックに使う。
  canAcceptEntry(confirmedCount: number): boolean;
}

export interface TournamentRepository {
  findById(tournamentId: string): TournamentView | null;
}

// entries が参照するチームのドメインビュー（代表者判定に必要な最小情報）。
export interface TeamView {
  readonly id: string;
  readonly name: string;
  readonly leaderUserId: string;
}

export interface TeamRepository {
  findById(teamId: string): TeamView | null;
  // 代表を務めるチーム（listMyEntries のチームスコープ解決に使う）。
  findByLeader(userId: string): TeamView | null;
}

// entries が参照するユーザーのドメインビュー（権限判定に必要な最小情報）。
export interface UserView {
  readonly id: string;
  readonly email: string;
  readonly role: "ADMIN" | "OPERATOR" | "LEADER" | "USER";
  readonly isAdmin: boolean;
}

export interface UserRepository {
  findById(userId: string): UserView | null;
}

// 通知ログ記録（COMMIT 後にアダプタ層から呼ばれる）。
export interface NotificationLogInput {
  deliveryType:
    | "ENTRY_CONFIRMED"
    | "CANCEL_FREE"
    | "CANCEL_PAID_USER"
    | "CANCEL_PAID_ADMIN";
  userId?: string | null;
  recipientEmail?: string | null;
  tournamentId?: string | null;
  entryId?: string | null;
  messagePayload: string;
}

export interface NotificationService {
  log(input: NotificationLogInput): void;
}
