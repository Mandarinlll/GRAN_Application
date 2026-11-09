// 種目区分の静的ルール判定（oop-architecture.md §2.2 / §5 / §8-3）。
//
// 現行 tournaments/utils/category.ts の isTeamCategory / requiresLeader / requiresTeam を
// ビヘイビア保存のまま移設した VO 相当のルール集。内部依存
//   requiresLeader = isTeamCategory || DOUBLES
//   requiresTeam   = requiresLeader
// を保存する。entries パイロットを含む複数 feature が共有するため tournaments/domain に置く。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import type { TournamentCategory } from "@/features/tournaments/types/tournament";

export class CategoryRules {
  // 団体戦系（代表者のみ・チーム必須）か。
  static isTeamCategory(category: TournamentCategory): boolean {
    return (
      category === "MEN_TEAM" ||
      category === "WOMEN_TEAM" ||
      category === "MIX_TEAM"
    );
  }

  // 代表者（LEADER）でなければ申込できない種目か（ダブルス・団体戦）。
  static requiresLeader(category: TournamentCategory): boolean {
    return CategoryRules.isTeamCategory(category) || category === "DOUBLES";
  }

  // チーム（team_id）の指定が必須の種目か。
  // ダブルスも代表者がチームを母体に申込む想定のためチーム必須とする。
  static requiresTeam(category: TournamentCategory): boolean {
    return CategoryRules.requiresLeader(category);
  }
}
