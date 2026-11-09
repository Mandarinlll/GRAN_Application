// 書き込み系のエントリーメンバー・エンティティ（oop-architecture.md §2.1）。
//
// EntrySummary が内包する読み取りビュー値（EntryMemberView DTO, entries/types/entry.ts）とは
// 別物として一意化している。本クラスは Application Service / Repository 内部でのみ生成・流通し、
// "use server" 境界を越えない。DB・Zod・Next.js に依存しない純粋な TypeScript とする。

import type { MemberType } from "@/features/entries/types/entry";

// Entry.createConfirmed / replaceMembers に渡すメンバー入力。
export interface MemberInput {
  memberType: MemberType;
  userId: string | null;
  guestName: string | null;
  orderNo: number;
}

export class EntryMember {
  constructor(
    readonly memberType: MemberType,
    readonly userId: string | null,
    readonly guestName: string | null,
    readonly orderNo: number,
  ) {}

  // 未定枠（後日割当）か。DB の is_pending に対応する（memberType === "PENDING"）。
  get isPending(): boolean {
    return this.memberType === "PENDING";
  }

  static fromInput(input: MemberInput): EntryMember {
    return new EntryMember(
      input.memberType,
      input.userId,
      input.guestName,
      input.orderNo,
    );
  }

  static fromInputs(inputs: MemberInput[]): EntryMember[] {
    return inputs.map((m) => EntryMember.fromInput(m));
  }
}
