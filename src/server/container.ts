// コンポジションルート（手動 DI / oop-architecture.md §7）。
//
// Application Service を、その SQLite リポジトリ実装と SqliteUnitOfWork に配線する唯一の場所。
// インフラ実装クラス（Sqlite*Repository）は他 feature から直接 new せず、必ずここで配線する。
// entries パイロット（FEAT-002）では、tournaments / teams / auth / notifications の本格 OOP 化が
// 未了のため、entries が必要とする最小依存インターフェースを既存の公開リポジトリ関数の上に
// 薄く配線する（§8 クロスインポート健全化: 他 feature の内部実装には触れず公開関数のみ利用）。

import { db } from "@/lib/db";
import { SqliteUnitOfWork } from "@/lib/unitOfWork";
import { SqliteEntryRepository } from "@/features/entries/infrastructure/SqliteEntryRepository";
import { EntryApplicationService } from "@/features/entries/application/EntryApplicationService";
import type {
  NotificationService,
  TeamRepository,
  TournamentRepository,
  TournamentView,
  UserRepository,
} from "@/features/entries/domain/dependencies";
import { findTournamentWithStats } from "@/features/tournaments/server/tournamentRepository";
import {
  findTeamById,
  findTeamByLeader,
} from "@/features/teams/server/teamRepository";
import { findUserById } from "@/features/auth/server/userRepository";
import { logNotification } from "@/features/notifications/server/notificationRepository";

// 共有の Unit of Work を生成する。各 Application Service はこれを注入して
// トランザクション境界（§6.1）を得る。
export function createUnitOfWork(): SqliteUnitOfWork {
  return new SqliteUnitOfWork(db);
}

// --- entries が必要とする最小依存の Sqlite 配線（既存公開関数の上に薄く載せる） ---

const tournamentRepository: TournamentRepository = {
  findById(tournamentId): TournamentView | null {
    const t = findTournamentWithStats(tournamentId);
    if (!t) return null;
    const capacity = t.capacity;
    return {
      id: t.id,
      title: t.title,
      category: t.category,
      eventDate: t.eventDate,
      entryFee: t.entryFee,
      teamSizeMin: t.teamSizeMin,
      teamSizeMax: t.teamSizeMax,
      isOpen: () => t.status === "OPEN",
      remaining: (confirmedCount: number) =>
        Math.max(0, capacity - confirmedCount),
      canAcceptEntry: (confirmedCount: number) => confirmedCount < capacity,
    };
  },
};

const teamRepository: TeamRepository = {
  findById(teamId) {
    const team = findTeamById(teamId);
    if (!team) return null;
    return { id: team.id, name: team.name, leaderUserId: team.leaderUserId };
  },
  findByLeader(userId) {
    const team = findTeamByLeader(userId);
    if (!team) return null;
    return { id: team.id, name: team.name, leaderUserId: team.leaderUserId };
  },
};

const userRepository: UserRepository = {
  findById(userId) {
    const user = findUserById(userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    };
  },
};

const notificationService: NotificationService = {
  log(input) {
    logNotification(input);
  },
};

// entries の Application Service を配線して返す（§7）。
// シングルトン db を共有するステートレス実装なので、都度 new で十分。
export function createEntryApplicationService(): EntryApplicationService {
  return new EntryApplicationService(
    createUnitOfWork(),
    new SqliteEntryRepository(db),
    tournamentRepository,
    teamRepository,
    userRepository,
    notificationService,
  );
}
