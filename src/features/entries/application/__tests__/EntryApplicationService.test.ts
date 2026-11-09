// EntryApplicationService のユースケース分岐検証（oop-architecture.md §9）。
// Repository / 依存は DB 不要のインメモリ fake に差し替えて、満員 / 重複 / 権限 / 受付期間外 /
// 同日重複確認 / TOCTOU / waitlist ネスト / cancel 料率 / bulk 集計を検証する。

import { describe, expect, it } from "vitest";

import { SqliteUnitOfWork } from "@/lib/unitOfWork";
import { EntryApplicationService } from "@/features/entries/application/EntryApplicationService";
import type {
  NotificationLogInput,
  NotificationService,
  TeamRepository,
  TeamView,
  TournamentRepository,
  TournamentView,
  UserRepository,
  UserView,
} from "@/features/entries/domain/dependencies";
import type { EntryRepository } from "@/features/entries/domain/EntryRepository";
import { Entry } from "@/features/entries/domain/Entry";
import type { EntryMember } from "@/features/entries/domain/EntryMember";
import type { Waitlist } from "@/features/entries/domain/Waitlist";
import type { Cancellation } from "@/features/entries/domain/Cancellation";
import type { TournamentCategory } from "@/features/tournaments/types/tournament";
import {
  ConflictConfirmationRequiredError,
  DuplicateEntryError,
  DuplicateWaitlistError,
  EntryFullError,
  EntryNotCancellableError,
  MemberCompositionError,
  PermissionDeniedError,
  TournamentNotOpenError,
} from "@/domain/errors";
import type { DatabaseSync } from "node:sqlite";

// --- fakes ---

// UoW は exec だけ使う。インメモリ fake db を渡して本物の SqliteUnitOfWork を構築する。
function fakeUow(): SqliteUnitOfWork {
  const fakeDb = { exec: () => undefined } as unknown as DatabaseSync;
  return new SqliteUnitOfWork(fakeDb);
}

interface TournamentSeed {
  id: string;
  title?: string;
  category: TournamentCategory;
  status?: "OPEN" | "CLOSED";
  eventDate?: string;
  entryFee?: number;
  capacity: number;
  teamSizeMin?: number | null;
  teamSizeMax?: number | null;
}

function tournamentRepo(seed: TournamentSeed): TournamentRepository {
  const view: TournamentView = {
    id: seed.id,
    title: seed.title ?? "大会X",
    category: seed.category,
    eventDate: seed.eventDate ?? "2099-12-31",
    entryFee: seed.entryFee ?? 5000,
    teamSizeMin: seed.teamSizeMin ?? null,
    teamSizeMax: seed.teamSizeMax ?? null,
    isOpen: () => (seed.status ?? "OPEN") === "OPEN",
    remaining: (c) => Math.max(0, seed.capacity - c),
    canAcceptEntry: (c) => c < seed.capacity,
  };
  return {
    findById: (id) => (id === seed.id ? view : null),
  };
}

function userRepo(user: UserView): UserRepository {
  return { findById: (id) => (id === user.id ? user : null) };
}

function teamRepo(teams: TeamView[]): TeamRepository {
  return {
    findById: (id) => teams.find((t) => t.id === id) ?? null,
    findByLeader: (uid) => teams.find((t) => t.leaderUserId === uid) ?? null,
  };
}

function notificationSpy(): {
  service: NotificationService;
  logs: NotificationLogInput[];
} {
  const logs: NotificationLogInput[] = [];
  return { service: { log: (i) => logs.push(i) }, logs };
}

// 設定可能なインメモリ EntryRepository fake。
class FakeEntryRepository implements EntryRepository {
  confirmedCount = 0;
  activeEntry = false;
  activeWaitlist = false;
  sameDayTitles: string[] = [];
  insertedEntries: Array<{ entry: Entry; members: EntryMember[] }> = [];
  insertedWaitlists: Waitlist[] = [];
  insertedCancellations: Cancellation[] = [];
  statusUpdates: Array<{ entryId: string; status: string }> = [];
  replacedMembers: Array<{ entryId: string; members: EntryMember[] }> = [];
  entryById: Entry | null = null;
  nextQueue = 1;

  findById(): Entry | null {
    return this.entryById;
  }
  hasActiveEntry(): boolean {
    return this.activeEntry;
  }
  findSameDayActiveEntryTitles(): string[] {
    return this.sameDayTitles;
  }
  listMembers() {
    return [];
  }
  listSummaries() {
    return [];
  }
  listInvolvedTournamentIds() {
    return new Set<string>();
  }
  countConfirmed(): number {
    return this.confirmedCount;
  }
  countActiveWaitlist(): number {
    return 0;
  }
  insertConfirmed(entry: Entry, members: EntryMember[]): string {
    this.insertedEntries.push({ entry, members });
    return "generated-entry-id";
  }
  updateStatus(entryId: string, status: string): void {
    this.statusUpdates.push({ entryId, status });
  }
  replaceMembers(entryId: string, members: EntryMember[]): void {
    this.replacedMembers.push({ entryId, members });
  }
  insertCancellation(cancellation: Cancellation): void {
    this.insertedCancellations.push(cancellation);
  }
  hasActiveWaitlist(): boolean {
    return this.activeWaitlist;
  }
  nextQueueNumber(): number {
    return this.nextQueue;
  }
  insertWaitlist(waitlist: Waitlist): void {
    this.insertedWaitlists.push(waitlist);
  }
}

const ADMIN: UserView = {
  id: "admin1",
  email: "admin@example.com",
  role: "ADMIN",
  isAdmin: true,
};
const PLAIN_USER: UserView = {
  id: "u1",
  email: "u1@example.com",
  role: "USER",
  isAdmin: false,
};
const LEADER: UserView = {
  id: "leader1",
  email: "leader@example.com",
  role: "LEADER",
  isAdmin: false,
};

function buildService(opts: {
  entries: FakeEntryRepository;
  tournament: TournamentSeed;
  user: UserView;
  teams?: TeamView[];
  notify?: NotificationService;
}): EntryApplicationService {
  return new EntryApplicationService(
    fakeUow(),
    opts.entries,
    tournamentRepo(opts.tournament),
    teamRepo(opts.teams ?? []),
    userRepo(opts.user),
    opts.notify ?? { log: () => undefined },
  );
}

const singlesCmd = {
  tournamentId: "t1",
  userId: "u1",
  teamId: null,
  members: [],
  acknowledgeConflict: false,
};

describe("submit", () => {
  it("受付期間外は TournamentNotOpenError", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", status: "CLOSED", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(() => service.submit(singlesCmd)).toThrow(TournamentNotOpenError);
  });

  it("代表者要件種目で一般ユーザーは leaderOnlySubmit", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "DOUBLES", capacity: 10 },
      user: PLAIN_USER,
    });
    try {
      service.submit({ ...singlesCmd, teamId: "team1" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionDeniedError);
      expect((e as PermissionDeniedError).context).toBe("leaderOnlySubmit");
    }
  });

  it("代表でないチームは teamOwnership", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "DOUBLES", capacity: 10 },
      user: LEADER,
      teams: [{ id: "team1", name: "T", leaderUserId: "other" }],
    });
    try {
      service.submit({ ...singlesCmd, userId: "leader1", teamId: "team1" });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PermissionDeniedError).context).toBe("teamOwnership");
    }
  });

  it("非シングルスで人数レンジ外は MemberCompositionError（範囲を保持）", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "DOUBLES", capacity: 10 },
      user: LEADER,
      teams: [{ id: "team1", name: "T", leaderUserId: "leader1" }],
    });
    try {
      service.submit({
        tournamentId: "t1",
        userId: "leader1",
        teamId: "team1",
        members: [
          { memberType: "REGISTERED", userId: "leader1", guestName: null, orderNo: 1 },
        ], // 1名（DOUBLES は 2名必須）
        acknowledgeConflict: false,
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MemberCompositionError);
      expect((e as MemberCompositionError).min).toBe(2);
      expect((e as MemberCompositionError).max).toBe(2);
    }
  });

  it("同日重複（未承認）は ConflictConfirmationRequiredError", () => {
    const entries = new FakeEntryRepository();
    entries.sameDayTitles = ["別大会"];
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    try {
      service.submit(singlesCmd);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictConfirmationRequiredError);
      expect((e as ConflictConfirmationRequiredError).conflictTournaments).toEqual([
        "別大会",
      ]);
    }
  });

  it("acknowledgeConflict=true なら同日重複を越えて確定する", () => {
    const entries = new FakeEntryRepository();
    entries.sameDayTitles = ["別大会"];
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    const outcome = service.submit({ ...singlesCmd, acknowledgeConflict: true });
    expect(outcome.kind).toBe("confirmed");
  });

  it("事前満員は preFull を返す（例外ではない）", () => {
    const entries = new FakeEntryRepository();
    entries.confirmedCount = 10;
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(service.submit(singlesCmd)).toEqual({ kind: "preFull" });
  });

  it("UoW 内の重複再チェックは DuplicateEntryError", () => {
    const entries = new FakeEntryRepository();
    entries.activeEntry = true;
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(() => service.submit(singlesCmd)).toThrow(DuplicateEntryError);
  });

  it("UoW 内の TOCTOU 満員は EntryFullError（事前満員とは別経路）", () => {
    const entries = new FakeEntryRepository();
    // 事前判定は remaining>0（confirmed=9<10）だが、UoW 内で確定数が capacity に達した状況を模す。
    let calls = 0;
    const base = new FakeEntryRepository();
    Object.assign(entries, base);
    entries.countConfirmed = () => {
      calls += 1;
      return calls <= 1 ? 9 : 10; // 事前=9（remaining=1）、UoW 内=10（満員）
    };
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(() => service.submit(singlesCmd)).toThrow(EntryFullError);
  });

  it("シングルス確定成功は本人を自動補完して挿入する", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    const outcome = service.submit(singlesCmd);
    expect(outcome.kind).toBe("confirmed");
    if (outcome.kind === "confirmed") {
      expect(outcome.entry.id).toBe("generated-entry-id");
    }
    expect(entries.insertedEntries).toHaveLength(1);
    const members = entries.insertedEntries[0].members;
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe("u1");
  });
});

describe("submitWaitlist", () => {
  it("SINGLES は leaderOnly 文言に到達しない（権限は requiresTeam 内のみ）", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    const outcome = service.submitWaitlist({
      tournamentId: "t1",
      userId: "u1",
      teamId: null,
    });
    expect(outcome.waitlist.queueNumber).toBe(1);
    expect(entries.insertedWaitlists).toHaveLength(1);
  });

  it("DOUBLES で一般ユーザーは leaderOnlyWaitlist", () => {
    const entries = new FakeEntryRepository();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "DOUBLES", capacity: 10 },
      user: PLAIN_USER,
      teams: [{ id: "team1", name: "T", leaderUserId: "u1" }],
    });
    try {
      service.submitWaitlist({ tournamentId: "t1", userId: "u1", teamId: "team1" });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PermissionDeniedError).context).toBe("leaderOnlyWaitlist");
    }
  });

  it("重複登録は DuplicateWaitlistError", () => {
    const entries = new FakeEntryRepository();
    entries.activeWaitlist = true;
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(() =>
      service.submitWaitlist({ tournamentId: "t1", userId: "u1", teamId: null }),
    ).toThrow(DuplicateWaitlistError);
  });
});

describe("cancel", () => {
  function confirmedEntry(): Entry {
    return new Entry(
      "e1",
      "t1",
      "u1",
      null,
      "SINGLES",
      "CONFIRMED",
      false,
      "",
      "",
      "",
    );
  }

  it("CONFIRMED でなければ EntryNotCancellableError", () => {
    const entries = new FakeEntryRepository();
    entries.entryById = new Entry(
      "e1",
      "t1",
      "u1",
      null,
      "SINGLES",
      "CANCELLED",
      false,
      "",
      "",
      "",
    );
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10, eventDate: "2099-01-01" },
      user: PLAIN_USER,
    });
    expect(() => service.cancel({ entryId: "e1", userId: "u1" })).toThrow(
      EntryNotCancellableError,
    );
  });

  it("権限なしは PermissionDeniedError(cancel)", () => {
    const entries = new FakeEntryRepository();
    entries.entryById = confirmedEntry();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: { id: "other", email: "o@e.com", role: "USER", isAdmin: false },
    });
    try {
      service.cancel({ entryId: "e1", userId: "other" });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PermissionDeniedError).context).toBe("cancel");
    }
  });

  it("無料キャンセル（8日前以上）は isPaid=false・updateStatus/insertCancellation を実行", () => {
    const entries = new FakeEntryRepository();
    entries.entryById = confirmedEntry();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10, eventDate: "2099-12-31", entryFee: 5000 },
      user: PLAIN_USER,
    });
    const when = new Date(2024, 0, 1);
    const outcome = service.cancel({ entryId: "e1", userId: "u1" }, when);
    expect(outcome.isPaid).toBe(false);
    expect(outcome.feeRate).toBe(0);
    expect(entries.statusUpdates).toEqual([{ entryId: "e1", status: "CANCELLED" }]);
    expect(entries.insertedCancellations).toHaveLength(1);
  });

  it("有償キャンセル（2日前）は isPaid=true・料率100%", () => {
    const entries = new FakeEntryRepository();
    entries.entryById = confirmedEntry();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10, eventDate: "2024-01-03", entryFee: 4000 },
      user: PLAIN_USER,
    });
    const when = new Date(2024, 0, 1);
    const outcome = service.cancel({ entryId: "e1", userId: "u1" }, when);
    expect(outcome.isPaid).toBe(true);
    expect(outcome.feeRate).toBe(100);
    expect(outcome.feeAmount).toBe(4000);
  });

  it("管理者は他人のエントリーをキャンセルできる", () => {
    const entries = new FakeEntryRepository();
    entries.entryById = confirmedEntry();
    const service = buildService({
      entries,
      tournament: { id: "t1", category: "SINGLES", capacity: 10, eventDate: "2099-12-31" },
      user: ADMIN,
    });
    const outcome = service.cancel({ entryId: "e1", userId: "admin1" });
    expect(outcome.entryId).toBe("e1");
  });
});

describe("bulkSubmit", () => {
  it("各件を独立に submit へ委譲する（確定/preFull を個別に返す）", () => {
    const full = new FakeEntryRepository();
    full.confirmedCount = 10;
    const service = buildService({
      entries: full,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(service.bulkSubmit(singlesCmd)).toEqual({ kind: "preFull" });

    const open = new FakeEntryRepository();
    const service2 = buildService({
      entries: open,
      tournament: { id: "t1", category: "SINGLES", capacity: 10 },
      user: PLAIN_USER,
    });
    expect(service2.bulkSubmit(singlesCmd).kind).toBe("confirmed");
  });
});
