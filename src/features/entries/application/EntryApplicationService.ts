// エントリー機能のアプリケーションサービス（oop-architecture.md §2.5 / §6.2 / §6.2.1 / §6.2.2）。
//
// 1 ユースケース = 1 メソッド。ドメイン前提条件の確認・権限判定（Finding A）・Repository 調整・
// トランザクション境界（UoW）の管理・Domain Service 呼び出しを担い、Entity/VO に振る舞いを委譲する。
// "use server" は持たない純 TypeScript クラス（テストから直接 new できる）。
// 権限判定（本人 / チーム代表 / 管理者・代表者限定カテゴリ）は submit/submitWaitlist/cancel/
// updateMembers の 4 ユースケースすべてで本サービスが担う（アダプタ層は権限判定を持たない）。

import {
  ConflictConfirmationRequiredError,
  DuplicateEntryError,
  DuplicateWaitlistError,
  EntryFullError,
  MemberCompositionError,
  MemberUpdateDeadlineError,
  NotFoundError,
  PermissionDeniedError,
  TeamRequiredError,
  TournamentNotOpenError,
} from "@/domain/errors";
import type { SqliteUnitOfWork } from "@/lib/unitOfWork";
import type { EntryRepository } from "@/features/entries/domain/EntryRepository";
import type {
  NotificationService,
  TeamRepository,
  TournamentRepository,
  UserRepository,
  UserView,
} from "@/features/entries/domain/dependencies";
import { Entry } from "@/features/entries/domain/Entry";
import { EntryMember } from "@/features/entries/domain/EntryMember";
import type { MemberInput } from "@/features/entries/domain/EntryMember";
import { Waitlist } from "@/features/entries/domain/Waitlist";
import { Cancellation } from "@/features/entries/domain/Cancellation";
import { CancelFeePolicy } from "@/features/entries/domain/CancelFeePolicy";
import { MemberComposition } from "@/features/entries/domain/MemberComposition";
import { CategoryRules } from "@/features/tournaments/domain/CategoryRules";
import type {
  EntrySummary,
  ListSummaryParams,
} from "@/features/entries/types/entry";

// submit の入力コマンド（現行 CreateEntryParams の後継 / §5）。
export interface SubmitEntryCommand {
  tournamentId: string;
  userId: string;
  teamId: string | null; // Zod 入力の teamId（未指定は null）
  members: MemberInput[]; // 変換済みメンバー入力（SINGLES は本サービスが本人補完）
  acknowledgeConflict: boolean;
}

// submit の戻り値（判別可能ユニオン・§2.5）。
// preFull は正常系の早期復帰であり例外にしない。
export type SubmitOutcome =
  | { kind: "confirmed"; entry: Entry; tournamentTitle: string; recipientEmail: string }
  | { kind: "preFull" };

export interface SubmitWaitlistCommand {
  tournamentId: string;
  userId: string;
  teamId: string | null;
}

// submitWaitlist の結果（アダプタの通知・戻り文言生成に必要な情報を同梱）。
export interface SubmitWaitlistOutcome {
  waitlist: Waitlist;
  tournamentTitle: string;
  recipientEmail: string;
}

export interface CancelEntryCommand {
  entryId: string;
  userId: string;
}

// cancel の結果（アダプタの通知・戻り文言分岐に必要な料率情報を同梱）。
export interface CancelOutcome {
  entryId: string;
  tournamentId: string;
  tournamentTitle: string;
  recipientEmail: string;
  feeRate: 0 | 50 | 100;
  feeAmount: number;
  isPaid: boolean;
}

export interface UpdateMembersCommand {
  entryId: string;
  userId: string;
  members: MemberInput[];
}

export class EntryApplicationService {
  constructor(
    private readonly uow: SqliteUnitOfWork,
    private readonly entries: EntryRepository,
    private readonly tournaments: TournamentRepository,
    private readonly teams: TeamRepository,
    private readonly users: UserRepository,
    private readonly notifications: NotificationService,
  ) {}

  // ---- 単一エントリー申込（§6.2 の 4 段構造を保存） ----
  submit(cmd: SubmitEntryCommand): SubmitOutcome {
    // (1) 前提・権限・メンバー構成（UoW 外）
    const user = this.users.findById(cmd.userId);
    if (!user) throw new NotFoundError("user");

    const tournament = this.tournaments.findById(cmd.tournamentId);
    if (!tournament) throw new NotFoundError("tournament");

    if (!tournament.isOpen()) throw new TournamentNotOpenError();

    const category = tournament.category;

    // 代表者権限チェック（ダブルス・団体戦）。submit はフラットに前段で検証する。
    if (
      CategoryRules.requiresLeader(category) &&
      user.role !== "LEADER" &&
      !user.isAdmin
    ) {
      throw new PermissionDeniedError("leaderOnlySubmit");
    }

    // チーム必須種目の teamId 検証 + 代表者/チーム所有権。
    let teamId: string | null = null;
    if (CategoryRules.requiresTeam(category)) {
      if (!cmd.teamId) throw new TeamRequiredError();
      const team = this.teams.findById(cmd.teamId);
      if (!team) throw new NotFoundError("team");
      if (team.leaderUserId !== user.id && !user.isAdmin) {
        throw new PermissionDeniedError("teamOwnership");
      }
      teamId = team.id;
    }

    // メンバー構成の決定。シングルスは本人のみを自動補完。
    let members: MemberInput[];
    if (category === "SINGLES") {
      members = [
        {
          memberType: "REGISTERED",
          userId: user.id,
          guestName: null,
          orderNo: 1,
        },
      ];
    } else {
      // 人数レンジの検証（未定枠・ゲストを含む総数）。
      if (
        !MemberComposition.isValidCount(
          cmd.members.length,
          category,
          tournament.teamSizeMin,
          tournament.teamSizeMax,
        )
      ) {
        const range = MemberComposition.countRange(
          category,
          tournament.teamSizeMin,
          tournament.teamSizeMax,
        );
        throw new MemberCompositionError(range.min, range.max);
      }
      members = cmd.members;
    }

    // (2) 同日重複確認（UoW 外）。未承認なら確認要求。
    const conflicts = this.entries.findSameDayActiveEntryTitles(
      tournament.eventDate,
      user.id,
      teamId,
      tournament.id,
    );
    if (conflicts.length > 0 && !cmd.acknowledgeConflict) {
      throw new ConflictConfirmationRequiredError(conflicts);
    }

    // (3) 事前満員判定（UoW 外）。残枠 0 を弾く（TOCTOU とは別経路・別文言）。
    if (tournament.remaining(this.entries.countConfirmed(tournament.id)) <= 0) {
      return { kind: "preFull" };
    }

    // (4) UoW 内: 重複「再」チェック + 定員「再」チェック + 挿入をアトミックに。
    const entry = this.uow.run(() => {
      if (this.entries.hasActiveEntry(tournament.id, user.id, teamId)) {
        throw new DuplicateEntryError();
      }
      if (
        !tournament.canAcceptEntry(this.entries.countConfirmed(tournament.id))
      ) {
        throw new EntryFullError();
      }
      const created = Entry.createConfirmed({
        tournamentId: tournament.id,
        userId: user.id,
        teamId,
        category,
        members,
      });
      // Repository が採番した entries.id を確定 Entry に反映して返す。
      const entryId = this.entries.insertConfirmed(created, created.members);
      return created.withId(entryId);
    });

    return {
      kind: "confirmed",
      entry,
      tournamentTitle: tournament.title,
      recipientEmail: user.email,
    };
  }

  // ---- キャンセル待ち登録（§6.2.1 のネスト構造を保存） ----
  submitWaitlist(cmd: SubmitWaitlistCommand): SubmitWaitlistOutcome {
    const user = this.users.findById(cmd.userId);
    if (!user) throw new NotFoundError("user");

    const tournament = this.tournaments.findById(cmd.tournamentId);
    if (!tournament) throw new NotFoundError("tournament");

    const category = tournament.category;

    // 代表者権限・チーム検証は requiresTeam ブロックの内側にのみ置く
    // （SINGLES では到達しない。submit のフラット構造へ正規化しない）。
    let teamId: string | null = null;
    if (CategoryRules.requiresTeam(category)) {
      if (
        CategoryRules.requiresLeader(category) &&
        user.role !== "LEADER" &&
        !user.isAdmin
      ) {
        throw new PermissionDeniedError("leaderOnlyWaitlist");
      }
      if (!cmd.teamId) throw new TeamRequiredError();
      const team = this.teams.findById(cmd.teamId);
      if (!team) throw new NotFoundError("team");
      if (team.leaderUserId !== user.id && !user.isAdmin) {
        throw new PermissionDeniedError("teamOwnership");
      }
      teamId = team.id;
    }

    // UoW 内: 重複判定 + 採番 + 挿入。
    const waitlist = this.uow.run(() => {
      if (this.entries.hasActiveWaitlist(tournament.id, user.id, teamId)) {
        throw new DuplicateWaitlistError();
      }
      const queueNumber = this.entries.nextQueueNumber(tournament.id);
      const created = Waitlist.create(
        { tournamentId: tournament.id, userId: user.id, teamId },
        queueNumber,
      );
      this.entries.insertWaitlist(created);
      return created;
    });

    return {
      waitlist,
      tournamentTitle: tournament.title,
      recipientEmail: user.email,
    };
  }

  // ---- キャンセル（§6.2.2 の UoW 内外の責務境界を保存） ----
  cancel(cmd: CancelEntryCommand, when: Date = new Date()): CancelOutcome {
    const user = this.users.findById(cmd.userId);
    if (!user) throw new NotFoundError("user");

    const entry = this.entries.findById(cmd.entryId);
    if (!entry) throw new NotFoundError("entry");

    // 権限: 本人 / チーム代表 / 管理者（現行アダプタの判定を文言・分岐ごと移設）。
    this.assertEntryManagePermission(entry, user, "cancel");

    const tournament = this.tournaments.findById(entry.tournamentId);
    if (!tournament) throw new NotFoundError("tournament");

    // 料率計算 + キャンセル可否検証 + Cancellation 生成は UoW 外。
    const policy = new CancelFeePolicy();
    const cancellation: Cancellation = entry.cancel(
      policy,
      tournament.eventDate,
      tournament.entryFee,
      when,
    );

    // UoW 内: ステータス更新 + cancellations 挿入のみアトミックに。
    this.uow.run(() => {
      this.entries.updateStatus(entry.id, "CANCELLED");
      this.entries.insertCancellation(cancellation);
    });

    return {
      entryId: entry.id,
      tournamentId: tournament.id,
      tournamentTitle: tournament.title ?? "",
      recipientEmail: user.email,
      feeRate: cancellation.feeRate,
      feeAmount: cancellation.feeAmount,
      isPaid: cancellation.isPaid,
    };
  }

  // ---- メンバー更新（未定枠割当・差し替え） ----
  updateMembers(cmd: UpdateMembersCommand, when: Date = new Date()): void {
    const user = this.users.findById(cmd.userId);
    if (!user) throw new NotFoundError("user");

    const entry = this.entries.findById(cmd.entryId);
    if (!entry) throw new NotFoundError("entry");

    // 権限: 本人 / チーム代表 / 管理者。
    this.assertEntryManagePermission(entry, user, "updateMembers");

    const tournament = this.tournaments.findById(entry.tournamentId);
    if (!tournament) throw new NotFoundError("tournament");

    // 変更期限: 開催日の3日前（00:00:00）以降は原則不可（管理者は可）。
    // 現行同様 entryFee=0 で日数差のみ算出する。
    const fee = new CancelFeePolicy().calculate(tournament.eventDate, 0, when);
    if (fee.daysBefore < 3 && !user.isAdmin) {
      throw new MemberUpdateDeadlineError();
    }

    const members = EntryMember.fromInputs(cmd.members);
    this.uow.run(() => {
      this.entries.replaceMembers(entry.id, members);
    });
  }

  // ---- 一括申込（各件独立トランザクション・§6.2） ----
  // bulk 全体を 1 UoW で束ねない。各 submit が自身の uow.run を 1 回張る。
  bulkSubmit(cmd: SubmitEntryCommand): SubmitOutcome {
    return this.submit(cmd);
  }

  // ---- 申込中・エントリー済み一覧（DTO のみ返す） ----
  listMyEntries(userId: string): {
    personal: EntrySummary[];
    team: EntrySummary[];
    teamName: string | null;
  } {
    const personal = this.entries.listSummaries({ userId, scope: "personal" });

    const team = this.teams.findByLeader(userId);
    const teamEntries = team
      ? this.entries.listSummaries({
          userId,
          teamId: team.id,
          scope: "team",
        } satisfies ListSummaryParams)
      : [];

    return {
      personal,
      team: teamEntries,
      teamName: team?.name ?? null,
    };
  }

  // 本人 / チーム代表 / 管理者のいずれかであることを要求する共通権限判定。
  // 現行 cancelEntryAction / updateMembersAction の分岐をそのまま移設している。
  private assertEntryManagePermission(
    entry: Entry,
    user: UserView,
    context: "cancel" | "updateMembers",
  ): void {
    let allowed = entry.userId === user.id;
    if (!allowed && entry.teamId) {
      const team = this.teams.findById(entry.teamId);
      allowed = team?.leaderUserId === user.id;
    }
    if (!allowed && user.isAdmin) allowed = true;
    if (!allowed) {
      throw new PermissionDeniedError(context);
    }
  }
}
