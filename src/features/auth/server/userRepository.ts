// users テーブルへのアクセスの薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.4 / §5）に伴い、SQL・行→User 変換は
// auth/infrastructure/SqliteUserRepository へ移設した。本モジュールは、まだ OOP 化前の
// 呼び出し元（entries の entryViewData.ts が findUserById を参照）を壊さないための
// 薄い委譲ラッパとして findUserById のみを残置する（SQL はこの層に残さない）。
// entries の本格 OOP 化が完了すれば本ラッパは撤去できる。

import { db } from "@/lib/db";
import { SqliteUserRepository } from "@/features/auth/infrastructure/SqliteUserRepository";
import type { User } from "@/types/user";

const repository = new SqliteUserRepository(db);

// id から User を1件取得する（セッション復元用、password_hash は返さない）。
export function findUserById(id: string): User | null {
  return repository.findById(id);
}
