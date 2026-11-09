// ドメイン例外 → ユーザー向け EntryActionResult への純粋マッパ
// （oop-architecture.md §2.6 / §4.2）。
//
// 文言は現行 actions.ts と 1 バイト一致で保存する（§11 がこれを要求）。
// DB・不明例外は操作別の汎用 catch 文言へマップし、内部詳細・スタックは出さない（§7.2）。

import {
  ConflictConfirmationRequiredError,
  DomainError,
  DuplicateEntryError,
  DuplicateWaitlistError,
  EntryFullError,
  EntryNotCancellableError,
  MemberCompositionError,
  MemberUpdateDeadlineError,
  NotFoundError,
  PermissionDeniedError,
  TeamRequiredError,
  TournamentNotOpenError,
} from "@/domain/errors";

// 操作種別（汎用 catch 文言の出し分けに使う）。
export type EntryOperation =
  | "submit"
  | "waitlist"
  | "cancel"
  | "updateMembers";

// actions.ts の EntryActionResult と同形の結果（型循環を避けるため再掲）。
export interface MappedEntryResult {
  ok: false;
  message?: string;
  needsConfirm?: boolean;
  conflictTournaments?: string[];
}

// 操作別の汎用 catch 文言（致命時・§4.2）。
const GENERIC_CATCH_MESSAGE: Record<EntryOperation, string> = {
  submit: "エントリー処理でエラーが発生しました。時間をおいてお試しください。",
  waitlist: "処理でエラーが発生しました。",
  cancel: "キャンセル処理でエラーが発生しました。",
  updateMembers: "メンバー更新でエラーが発生しました。",
};

// 権限コンテキスト別の文言（§4.2(b)）。
const PERMISSION_MESSAGE = {
  leaderOnlySubmit:
    "この種目は代表者のみ申込できます。チームの代表者にご依頼ください。",
  leaderOnlyWaitlist: "この種目は代表者のみ申込できます。",
  teamOwnership: "ご自身が代表を務めるチームでのみ申込できます。",
  cancel: "このエントリーをキャンセルする権限がありません。",
  updateMembers: "メンバーを変更する権限がありません。",
} as const;

// NotFound コンテキスト別の文言（§4.3）。
const NOT_FOUND_MESSAGE = {
  entry: "エントリーが見つかりません。",
  user: "ユーザーが見つかりません。",
  tournament: "大会が見つかりません。",
  team: "チームが見つかりません。",
} as const;

// ドメイン例外 → EntryActionResult。該当しない例外（DB・不明）は汎用 catch 文言へ。
export function toActionResult(
  error: unknown,
  operation: EntryOperation,
): MappedEntryResult {
  if (error instanceof ConflictConfirmationRequiredError) {
    return {
      ok: false,
      needsConfirm: true,
      conflictTournaments: error.conflictTournaments,
      message:
        "同日に既にエントリー中の大会があります。重複参加にならないかご確認ください。",
    };
  }
  if (error instanceof PermissionDeniedError) {
    return { ok: false, message: PERMISSION_MESSAGE[error.context] };
  }
  if (error instanceof NotFoundError) {
    return { ok: false, message: NOT_FOUND_MESSAGE[error.context] };
  }
  if (error instanceof TournamentNotOpenError) {
    return {
      ok: false,
      message: "この大会は現在エントリーを受け付けていません。",
    };
  }
  if (error instanceof TeamRequiredError) {
    return { ok: false, message: "申込チームを指定してください。" };
  }
  if (error instanceof MemberCompositionError) {
    return {
      ok: false,
      message: `出場メンバーは ${error.min}〜${error.max} 名で登録してください。`,
    };
  }
  if (error instanceof DuplicateEntryError) {
    return { ok: false, message: "この大会には既にエントリー済みです。" };
  }
  if (error instanceof EntryFullError) {
    return {
      ok: false,
      message: "直前に満員となりました。キャンセル待ちへご登録ください。",
    };
  }
  if (error instanceof DuplicateWaitlistError) {
    return { ok: false, message: "既にキャンセル待ちに登録済みです。" };
  }
  if (error instanceof EntryNotCancellableError) {
    return { ok: false, message: "このエントリーはキャンセルできません。" };
  }
  if (error instanceof MemberUpdateDeadlineError) {
    return {
      ok: false,
      message: "メンバー変更は開催3日前までです。期限を過ぎています。",
    };
  }
  // その他の DomainError（想定外）・DB 例外・不明例外は操作別の汎用 catch 文言へ。
  if (error instanceof DomainError) {
    return { ok: false, message: GENERIC_CATCH_MESSAGE[operation] };
  }
  return { ok: false, message: GENERIC_CATCH_MESSAGE[operation] };
}

// 事前満員（SubmitOutcome.preFull）の文言（§4.2(a)）。
export function preFullMessage(): string {
  return "この大会は満員です。キャンセル待ちへご登録ください。";
}
