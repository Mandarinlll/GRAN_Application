// teams / team_members テーブルの永続化抽象（oop-architecture.md §2.4）。
//
// 設計上 Team にはアプリ層で守るべき不変条件が割り当てられていないため、Team は
// 現行どおりプレーン DTO（types/team.ts）のまま扱い、本リポジトリで取得を抽象化する。
// SQL・行→DTO 変換はインフラ実装（SqliteTeamRepository）に隠蔽する。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type {
  Team,
  TeamWithMembers,
} from "@/features/teams/types/team";

export interface TeamRepository {
  // id からチームを1件取得する。
  findById(teamId: string): Team | null;
  // ユーザーが代表者（leader）を務めるチームを取得する。無ければ null。
  findByLeader(userId: string): Team | null;
  // チーム + 所属メンバー（表示情報付き）を取得する。
  findWithMembers(teamId: string): TeamWithMembers | null;
  // ユーザーがそのチームに所属しているか（メンバーテーブル基準）。
  isTeamMember(teamId: string, userId: string): boolean;
}
