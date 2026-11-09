// ランキング整列・順位付与のドメインサービス（oop-architecture.md §2.3 / §5）。
//
// 現行 data/utils/ranking.ts の rankUsers と、dataViewData.ts の内部ヘルパ buildTeamRanking を
// 吸収する。buildSelfRankSummary は private メソッドとして同居させる（公開ランタイム API を増やさない）。
// tier / classLabel は共有ドメイン基盤 GranLevel に委譲し、data → auth のクロス import を解消する
// （§8-3 / §8-4）。安定順序:
//   個人/階級内: gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC
//   チーム      : teamRating DESC → リーダーニックネーム ASC
// 順位は 1 始まり・同率同順位（standard competition ranking）。
// DB・Zod・Next.js に依存しない純粋な TypeScript とする（ドメイン層の import 制約）。

import { GranLevel } from "@/domain/GranLevel";
import { TeamRatingService } from "@/features/data/domain/TeamRatingService";
import type {
  RankableUser,
  RankedTeam,
  RankedUser,
  SelfRankSummary,
  TeamRatingRow,
} from "@/features/data/types/data";
import type { CurrentUser } from "@/types/home";

// 安定順序の比較関数（gran_level DESC → rated_match_count DESC → login_id ASC → created_at ASC）。
function compareRankable(a: RankableUser, b: RankableUser): number {
  if (a.granLevel !== b.granLevel) {
    return b.granLevel - a.granLevel; // DESC
  }
  if (a.ratedMatchCount !== b.ratedMatchCount) {
    return b.ratedMatchCount - a.ratedMatchCount; // DESC
  }
  if (a.loginId !== b.loginId) {
    return a.loginId < b.loginId ? -1 : 1; // ASC
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1; // ASC
  }
  return 0;
}

export class RankingService {
  constructor(
    private readonly teamRating: TeamRatingService = new TeamRatingService(),
  ) {}

  // ユーザー集合を安定順序で整列し、1 始まりの順位（同率は同順位）を付与する。
  // 入力配列は変更せず、新しい配列を返す。
  rankUsers(users: RankableUser[]): RankedUser[] {
    const sorted = [...users].sort(compareRankable);

    const result: RankedUser[] = [];
    let currentRank = 0;
    let prevGranLevel: number | null = null;

    for (let i = 0; i < sorted.length; i += 1) {
      const user = sorted[i];

      if (prevGranLevel === null || user.granLevel !== prevGranLevel) {
        currentRank = i + 1;
        prevGranLevel = user.granLevel;
      }

      const level = new GranLevel(user.granLevel);
      result.push({
        ...user,
        rank: currentRank,
        tier: level.toTier(),
        classLabel: level.toClassLabel(),
      });
    }

    return result;
  }

  // チーム順位行をチームランキングのビューモデルへ整列・順位付与する。
  // - computeTeamRating が null（有効メンバー 0 名）のチームは除外する（Requirement 4.6）。
  // - teamRating 降順、同率はリーダーニックネーム昇順で整列する（Requirement 4.7）。
  // - 同一 teamRating には同一順位を付与（standard competition ranking / Property 6）。
  buildTeamRanking(rows: TeamRatingRow[]): RankedTeam[] {
    const rated = rows
      .map((row) => {
        const teamRating = this.teamRating.computeTeamRating(row.memberLevels);
        if (teamRating === null) return null;
        return {
          id: row.id,
          name: row.name,
          avatarUrl: row.avatarUrl,
          leaderNickname: row.leaderNickname,
          teamRating,
        };
      })
      .filter((team): team is Omit<RankedTeam, "rank"> => team !== null);

    // teamRating 降順 → リーダーニックネーム昇順で安定整列。
    rated.sort((a, b) => {
      if (a.teamRating !== b.teamRating) {
        return b.teamRating - a.teamRating; // DESC
      }
      if (a.leaderNickname !== b.leaderNickname) {
        return a.leaderNickname < b.leaderNickname ? -1 : 1; // ASC
      }
      return 0;
    });

    // 同一 teamRating には同一順位を付与（standard competition ranking）。
    const result: RankedTeam[] = [];
    let currentRank = 0;
    let prevRating: number | null = null;
    for (let i = 0; i < rated.length; i += 1) {
      const team = rated[i];
      if (prevRating === null || team.teamRating !== prevRating) {
        currentRank = i + 1;
        prevRating = team.teamRating;
      }
      result.push({ ...team, rank: currentRank });
    }

    return result;
  }

  // 閲覧ユーザー自身のサマリ（全体ランキング基準）を組み立てる。
  // - overallRank: 全体ランキング内で自身の loginId に一致する行の rank。母集団外は null。
  // - totalCount: 母集団人数。granLevel: 自身の GRANレベル（母集団外でも表示）。
  // - tier / classLabel: 査定済は GranLevel 由来。査定中は classLabel="査定中"。
  buildSelfRankSummary(
    viewer: CurrentUser,
    ranking: RankedUser[],
  ): SelfRankSummary {
    // getCurrentUser は未査定時に classLabel="査定中" を返すため、これを査定状態の判定に用いる。
    const isCalibrated = viewer.classLabel !== "査定中";
    const totalCount = ranking.length;

    const selfRow = isCalibrated
      ? ranking.find((user) => user.loginId === viewer.displayId)
      : undefined;

    const level = new GranLevel(viewer.granLevel);
    return {
      granLevel: viewer.granLevel,
      isCalibrated,
      totalCount,
      overallRank: selfRow?.rank ?? null,
      tier: level.toTier(),
      classLabel: isCalibrated ? level.toClassLabel() : "査定中",
    };
  }
}
