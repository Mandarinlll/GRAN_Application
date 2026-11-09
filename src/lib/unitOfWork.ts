// トランザクション境界を Application Service に提供する Unit of Work（oop-architecture.md §6.1）。
//
// 現行は Repository 関数の内部で BEGIN IMMEDIATE していたが、OOP 化後はトランザクション境界を
// Application Service が持ち、node:sqlite の同期的な原子性をこの UoW でラップする。
// node:sqlite の DatabaseSync は同期 API なので work は同期関数とする（現行実装と同じ前提）。
// SQLite は入れ子トランザクション非対応のためネストした run は行わない。1 ユースケース = 1 run を原則とする。

import type { DatabaseSync } from "node:sqlite";

export class SqliteUnitOfWork {
  constructor(private readonly db: DatabaseSync) {}

  run<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
