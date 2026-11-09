// toActionResult の文言マッピング検証（oop-architecture.md §4.2 / §11）。
// 現行 actions.ts と 1 バイト一致であることを担保する（ビヘイビア保存）。

import { describe, expect, it } from "vitest";

import {
  preFullMessage,
  toActionResult,
} from "@/features/entries/server/toActionResult";
import {
  ConflictConfirmationRequiredError,
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

describe("toActionResult（非権限系ドメイン例外 → 文言）", () => {
  it("TournamentNotOpenError", () => {
    expect(toActionResult(new TournamentNotOpenError(), "submit").message).toBe(
      "この大会は現在エントリーを受け付けていません。",
    );
  });

  it("TeamRequiredError", () => {
    expect(toActionResult(new TeamRequiredError(), "submit").message).toBe(
      "申込チームを指定してください。",
    );
  });

  it("MemberCompositionError（範囲を埋め込む）", () => {
    expect(
      toActionResult(new MemberCompositionError(4, 6), "submit").message,
    ).toBe("出場メンバーは 4〜6 名で登録してください。");
  });

  it("DuplicateEntryError", () => {
    expect(toActionResult(new DuplicateEntryError(), "submit").message).toBe(
      "この大会には既にエントリー済みです。",
    );
  });

  it("EntryFullError（TOCTOU 文言）", () => {
    expect(toActionResult(new EntryFullError(), "submit").message).toBe(
      "直前に満員となりました。キャンセル待ちへご登録ください。",
    );
  });

  it("preFull（事前満員文言）は EntryFullError とは別", () => {
    expect(preFullMessage()).toBe(
      "この大会は満員です。キャンセル待ちへご登録ください。",
    );
  });

  it("ConflictConfirmationRequiredError（needsConfirm + 一覧）", () => {
    const r = toActionResult(
      new ConflictConfirmationRequiredError(["大会A"]),
      "submit",
    );
    expect(r.needsConfirm).toBe(true);
    expect(r.conflictTournaments).toEqual(["大会A"]);
    expect(r.message).toBe(
      "同日に既にエントリー中の大会があります。重複参加にならないかご確認ください。",
    );
  });

  it("DuplicateWaitlistError", () => {
    expect(toActionResult(new DuplicateWaitlistError(), "waitlist").message).toBe(
      "既にキャンセル待ちに登録済みです。",
    );
  });

  it("EntryNotCancellableError", () => {
    expect(toActionResult(new EntryNotCancellableError(), "cancel").message).toBe(
      "このエントリーはキャンセルできません。",
    );
  });

  it("MemberUpdateDeadlineError", () => {
    expect(
      toActionResult(new MemberUpdateDeadlineError(), "updateMembers").message,
    ).toBe("メンバー変更は開催3日前までです。期限を過ぎています。");
  });
});

describe("toActionResult（NotFound 文脈別）", () => {
  it("entry / user / tournament / team", () => {
    expect(toActionResult(new NotFoundError("entry"), "cancel").message).toBe(
      "エントリーが見つかりません。",
    );
    expect(toActionResult(new NotFoundError("user"), "submit").message).toBe(
      "ユーザーが見つかりません。",
    );
    expect(
      toActionResult(new NotFoundError("tournament"), "submit").message,
    ).toBe("大会が見つかりません。");
    expect(toActionResult(new NotFoundError("team"), "submit").message).toBe(
      "チームが見つかりません。",
    );
  });
});

describe("toActionResult（権限文脈別 §4.2(b)）", () => {
  it("5 文脈すべて 1 バイト一致", () => {
    expect(
      toActionResult(new PermissionDeniedError("leaderOnlySubmit"), "submit")
        .message,
    ).toBe("この種目は代表者のみ申込できます。チームの代表者にご依頼ください。");
    expect(
      toActionResult(new PermissionDeniedError("leaderOnlyWaitlist"), "waitlist")
        .message,
    ).toBe("この種目は代表者のみ申込できます。");
    expect(
      toActionResult(new PermissionDeniedError("teamOwnership"), "submit")
        .message,
    ).toBe("ご自身が代表を務めるチームでのみ申込できます。");
    expect(
      toActionResult(new PermissionDeniedError("cancel"), "cancel").message,
    ).toBe("このエントリーをキャンセルする権限がありません。");
    expect(
      toActionResult(new PermissionDeniedError("updateMembers"), "updateMembers")
        .message,
    ).toBe("メンバーを変更する権限がありません。");
  });
});

describe("toActionResult（DB・不明例外 → 操作別汎用文言）", () => {
  it("submit / waitlist / cancel / updateMembers", () => {
    expect(toActionResult(new Error("db"), "submit").message).toBe(
      "エントリー処理でエラーが発生しました。時間をおいてお試しください。",
    );
    expect(toActionResult(new Error("db"), "waitlist").message).toBe(
      "処理でエラーが発生しました。",
    );
    expect(toActionResult(new Error("db"), "cancel").message).toBe(
      "キャンセル処理でエラーが発生しました。",
    );
    expect(toActionResult(new Error("db"), "updateMembers").message).toBe(
      "メンバー更新でエラーが発生しました。",
    );
  });
});
