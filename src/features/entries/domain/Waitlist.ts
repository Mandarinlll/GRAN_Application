// キャンセル待ちエンティティ（oop-architecture.md §2.1 / §6.2.1）。
//
// Application Service が採番した queue_number から生成する書き込み系エンティティ。
// waitlists テーブルへの挿入に必要なフィールドを保持する（id / 日時 / status は Repository が設定）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする。

export interface CreateWaitlistCommand {
  tournamentId: string;
  userId: string;
  teamId: string | null;
}

export class Waitlist {
  constructor(
    readonly tournamentId: string,
    readonly userId: string,
    readonly teamId: string | null,
    readonly queueNumber: number,
  ) {}

  static create(cmd: CreateWaitlistCommand, queueNumber: number): Waitlist {
    return new Waitlist(
      cmd.tournamentId,
      cmd.userId,
      cmd.teamId,
      queueNumber,
    );
  }
}
