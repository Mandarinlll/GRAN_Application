// teams / team_members テーブルへのアクセスの薄い委譲ラッパ。
//
// OOP 化（oop-architecture.md §2.4 / §5）に伴い、SQL・行→Team 変換は
// teams/infrastructure/SqliteTeamRepository へ移設した。本モジュールは、まだ OOP 化前の
// 呼び出し元（entries の entryViewData.ts が findTeamByLeader / findTeamWithMembers を参照）を
// 壊さないための薄い委譲ラッパとして、使用中の公開関数のみを残置する（SQL はこの層に残さない）。

import { db } from "@/lib/db";
import { SqliteTeamRepository } from "@/features/teams/infrastructure/SqliteTeamRepository";
import type { Team, TeamWithMembers } from "@/features/teams/types/team";

const repository = new SqliteTeamRepository(db);

// ユーザーが代表者（leader）を務めるチームを取得する。無ければ null。
export function findTeamByLeader(userId: string): Team | null {
  return repository.findByLeader(userId);
}

// id からチームを1件取得する。
export function findTeamById(teamId: string): Team | null {
  return repository.findById(teamId);
}

// チーム + 所属メンバー（表示情報付き）を取得する。
export function findTeamWithMembers(teamId: string): TeamWithMembers | null {
  return repository.findWithMembers(teamId);
}
