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
import { SqliteTournamentRepository } from "@/features/tournaments/infrastructure/SqliteTournamentRepository";
import { SqliteTeamRepository } from "@/features/teams/infrastructure/SqliteTeamRepository";
import { SqliteNotificationRepository } from "@/features/notifications/infrastructure/SqliteNotificationRepository";
import { NotificationService as RealNotificationService } from "@/features/notifications/application/NotificationService";
import { SqliteUserRepository } from "@/features/auth/infrastructure/SqliteUserRepository";
import { AuthApplicationService } from "@/features/auth/application/AuthApplicationService";
import type { PasswordHasher } from "@/features/auth/application/AuthApplicationService";
import { CurrentUserService } from "@/features/auth/application/CurrentUserService";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SqliteDataRepository } from "@/features/data/infrastructure/SqliteDataRepository";
import { DataViewService } from "@/features/data/application/DataViewService";

// 共有の Unit of Work を生成する。各 Application Service はこれを注入して
// トランザクション境界（§6.1）を得る。
export function createUnitOfWork(): SqliteUnitOfWork {
  return new SqliteUnitOfWork(db);
}

// --- entries が必要とする最小依存の Sqlite 配線（既存公開関数の上に薄く載せる） ---

// tournaments の本物の Repository 実装。entries の最小依存（TournamentView）は
// Tournament エンティティの受付可否・残枠判定をそのまま委譲して満たす（§8-4 一方向 import）。
const sqliteTournamentRepository = new SqliteTournamentRepository(db);

const tournamentRepository: TournamentRepository = {
  findById(tournamentId): TournamentView | null {
    const t = sqliteTournamentRepository.findById(tournamentId);
    if (!t) return null;
    return {
      id: t.id,
      title: t.title,
      category: t.category,
      eventDate: t.eventDate,
      entryFee: t.entryFee,
      teamSizeMin: t.teamSizeMin,
      teamSizeMax: t.teamSizeMax,
      isOpen: () => t.isOpen(),
      remaining: (confirmedCount: number) => t.remaining(confirmedCount),
      canAcceptEntry: (confirmedCount: number) =>
        t.canAcceptEntry(confirmedCount),
    };
  },
};

// teams の本物の Repository 実装。entries の最小依存（TeamView）もこれ経由で解決する。
const sqliteTeamRepository = new SqliteTeamRepository(db);

const teamRepository: TeamRepository = {
  findById(teamId) {
    const team = sqliteTeamRepository.findById(teamId);
    if (!team) return null;
    return { id: team.id, name: team.name, leaderUserId: team.leaderUserId };
  },
  findByLeader(userId) {
    const team = sqliteTeamRepository.findByLeader(userId);
    if (!team) return null;
    return { id: team.id, name: team.name, leaderUserId: team.leaderUserId };
  },
};

// auth の本物の UserRepository 実装。entries の最小依存（UserView）もこれ経由で解決する。
const sqliteUserRepository = new SqliteUserRepository(db);

const userRepository: UserRepository = {
  findById(userId) {
    const user = sqliteUserRepository.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    };
  },
};

// notifications の本物の Service/Repository 実装。entries の最小依存（NotificationService）は
// これへ委譲する（FEAT-002 のスタブを置換・§8 一方向 import）。
const realNotificationService = new RealNotificationService(
  new SqliteNotificationRepository(db),
);

const notificationService: NotificationService = {
  log(input) {
    realNotificationService.log(input);
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

// --- auth（FEAT-003 で本格 OOP 化） ---

// bcrypt ベースのパスワードハッシュ（lib/password の薄いアダプタ）。
const passwordHasher: PasswordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
};

// 認証ユースケースの Application Service を配線して返す。
export function createAuthApplicationService(): AuthApplicationService {
  return new AuthApplicationService(sqliteUserRepository, passwordHasher);
}

// 現在ユーザー解決サービスを配線して返す。
export function createCurrentUserService(): CurrentUserService {
  return new CurrentUserService(sqliteUserRepository);
}

// --- data（FEAT-003 で本格 OOP 化） ---

// データタブのビューモデル組み立てサービスを配線して返す。
export function createDataViewService(): DataViewService {
  return new DataViewService(new SqliteDataRepository(db));
}
