// 確定エントリー・エンティティ（oop-architecture.md §2.1 / §6.2 / §6.2.2）。
//
// 書き込み系の内部表現であり、ドメイン不変条件（キャンセル可否）と確定エントリー生成を宿す。
// Application Service / Repository 内部でのみ生成・流通し、"use server" 境界を越えない
// （境界を越える読み取りは EntrySummary / EntryMemberView DTO）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする。

import type { EntryStatus } from "@/features/entries/types/entry";
import type { TournamentCategory } from "@/features/tournaments/types/tournament";
import { EntryNotCancellableError } from "@/domain/errors";
import { EntryMember } from "@/features/entries/domain/EntryMember";
import type { MemberInput } from "@/features/entries/domain/EntryMember";
import { Cancellation } from "@/features/entries/domain/Cancellation";
import type { CancelFeePolicy } from "@/features/entries/domain/CancelFeePolicy";

// 確定エントリー生成コマンド（現行 CreateEntryParams の 1:1 置換 = SubmitEntryCommand と同形）。
export interface CreateConfirmedCommand {
  tournamentId: string;
  userId: string;
  teamId: string | null;
  category: TournamentCategory;
  isProxy?: boolean;
  members: MemberInput[];
}

export class Entry {
  // 永続化済みエントリーのリハイドレーション用（全フィールド）。
  // 未永続（createConfirmed 直後）の場合 id / 日時は空文字で、Repository が採番する。
  constructor(
    readonly id: string,
    readonly tournamentId: string,
    readonly userId: string,
    readonly teamId: string | null,
    readonly category: TournamentCategory,
    readonly status: EntryStatus,
    readonly isProxy: boolean,
    readonly appliedAt: string,
    readonly createdAt: string,
    readonly updatedAt: string,
    readonly members: EntryMember[] = [],
  ) {}

  // 確定エントリー（CONFIRMED）をメンバー付きで新規生成する。
  // id / 日時は永続化時に Repository が採番するため、ここでは空文字で初期化する。
  static createConfirmed(cmd: CreateConfirmedCommand): Entry {
    return new Entry(
      "",
      cmd.tournamentId,
      cmd.userId,
      cmd.teamId,
      cmd.category,
      "CONFIRMED",
      cmd.isProxy ?? false,
      "",
      "",
      "",
      EntryMember.fromInputs(cmd.members),
    );
  }

  // 永続化時に Repository が採番した id を反映した複製を返す（他フィールドは不変）。
  withId(id: string): Entry {
    return new Entry(
      id,
      this.tournamentId,
      this.userId,
      this.teamId,
      this.category,
      this.status,
      this.isProxy,
      this.appliedAt,
      this.createdAt,
      this.updatedAt,
      this.members,
    );
  }

  // キャンセル可否の不変条件（status === "CONFIRMED" のみキャンセル可）を検証し、
  // CancelFeePolicy でキャンセル料を算出して Cancellation エンティティを生成する。
  cancel(
    policy: CancelFeePolicy,
    eventDate: string,
    entryFee: number,
    when: Date = new Date(),
  ): Cancellation {
    if (this.status !== "CONFIRMED") {
      throw new EntryNotCancellableError();
    }
    const fee = policy.calculate(eventDate, entryFee, when);
    return new Cancellation(
      this.id,
      fee.daysBefore,
      fee.feeRate,
      fee.feeAmount,
      fee.isPaid,
      fee.adminStatus,
    );
  }
}
