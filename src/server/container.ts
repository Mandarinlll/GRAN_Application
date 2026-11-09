// コンポジションルート（手動 DI / oop-architecture.md §7）。
//
// Application Service を、その SQLite リポジトリ実装と SqliteUnitOfWork に配線する唯一の場所。
// インフラ実装クラス（Sqlite*Repository）は他 feature から直接 new せず、必ずここで配線する。
//
// FEAT-001 時点では共有配線の骨格のみを置く（まだ具体的な Application Service は存在しない）。
// 具体的な createEntryApplicationService()（§7）は entries パイロット（FEAT-002）で追加する。
// それまでの間、db と SqliteUnitOfWork が確実に配線できることを型レベルで保証する
// 最小のファクトリ（createUnitOfWork）を公開しておく。これは FEAT-002 で各 Application Service
// の組み立てから利用される。

import { db } from "@/lib/db";
import { SqliteUnitOfWork } from "@/lib/unitOfWork";

// 共有の Unit of Work を生成する。各 Application Service はこれを注入して
// トランザクション境界（§6.1）を得る。
export function createUnitOfWork(): SqliteUnitOfWork {
  return new SqliteUnitOfWork(db);
}
