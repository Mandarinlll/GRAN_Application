// 全 feature 共通のドメイン例外階層（oop-architecture.md §4.1）。
//
// 「予期されるドメイン結果」は型付き例外（DomainError サブクラス）で表現し、
// Server Action アダプタ層（toActionResult）でユーザー向け Result 型へ変換する。
// 本モジュールは DB・Zod・Next.js に一切依存しない純粋な TypeScript とする
// （ドメイン層の import 制約に従う）。

export abstract class DomainError extends Error {
  abstract readonly code: string; // 例: "ENTRY_FULL"
}

export class EntryFullError extends DomainError {
  readonly code = "ENTRY_FULL";
}

export class DuplicateEntryError extends DomainError {
  readonly code = "DUPLICATE_ENTRY";
}

export class DuplicateWaitlistError extends DomainError {
  readonly code = "DUPLICATE_WAITLIST";
}

export class EntryNotCancellableError extends DomainError {
  readonly code = "NOT_CANCELLABLE";
}

export class TournamentNotOpenError extends DomainError {
  readonly code = "TOURNAMENT_NOT_OPEN";
}

// 「見つからない」の文脈別表現（アダプタ層が文脈ごとの文言へマップする）。
export type NotFoundContext = "entry" | "user" | "tournament" | "team";

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
  constructor(readonly context: NotFoundContext) {
    super();
  }
}

// チーム必須種目で teamId が未指定（現行「申込チームを指定してください。」）。
// 前提（入力）エラーであり権限例外ではないため PermissionDeniedError とは別クラスにする。
export class TeamRequiredError extends DomainError {
  readonly code = "TEAM_REQUIRED";
}

export class MemberCompositionError extends DomainError {
  readonly code = "INVALID_MEMBERS";
  // 現行文言「出場メンバーは N〜M 名で登録してください。」の N / M を保持する。
  constructor(
    readonly min: number,
    readonly max: number,
  ) {
    super();
  }
}

// メンバー変更期限切れ（現行「メンバー変更は開催3日前までです。期限を過ぎています。」）。
export class MemberUpdateDeadlineError extends DomainError {
  readonly code = "MEMBER_UPDATE_DEADLINE";
}

// 権限エラーは操作別・種目別に異なるユーザー文言を持つため、context で文脈を保持する。
// context → 文言の対応は oop-architecture.md §4.2(b) の権限メッセージ表
// （アダプタ層の toActionResult）が正とする。
export type PermissionContext =
  | "cancel" // キャンセル権限
  | "updateMembers" // メンバー変更権限
  | "leaderOnlySubmit" // 代表者のみ申込可（種目要件）
  | "leaderOnlyWaitlist" // 代表者のみ申込可（キャンセル待ち・短縮文言）
  | "teamOwnership"; // 自身が代表のチームでのみ申込可

export class PermissionDeniedError extends DomainError {
  readonly code = "PERMISSION_DENIED";
  constructor(readonly context: PermissionContext) {
    super();
  }
}

export class ConflictConfirmationRequiredError extends DomainError {
  readonly code = "CONFLICT_CONFIRM";
  constructor(readonly conflictTournaments: string[]) {
    super();
  }
}
