// データタブ パネルの分岐ユニットテスト（Task 7.9）。
//
// 純粋な presentational コンポーネントの表示分岐を、react-dom/server の
// renderToStaticMarkup で静的 HTML 文字列へ描画し、含まれる文言・マークアップを
// 検証する。jsdom / React Testing Library を追加せず node 環境で完結させる
// （vitest.config.ts は environment: "node"）。
//
// 検証する分岐:
//   - EntryHistoryPanel: 空状態 vs エラー + 再取得、フィルタ結果 0 件の条件一致なし
//     （Requirements 6.7, 10.3）
//   - RankRow / PersonalRankingPanel: 自身行の識別テキスト「（あなた）」付与
//     （Requirements 2.4, 2.6）
//   - PerformanceSummaryCard: winRate null のダッシュ「—」、error=true の ErrorRetry
//     （Requirements 9.3, 9.5）
//   - LevelHistoryPanel: 履歴 0 件の空状態（5.6）、error=true の ErrorRetry（5.8）
//   - LevelDistributionPanel: 未査定（isCalibrated=false）時の位置インジケータ非表示 +
//     説明テキスト（Requirements 7.5）

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { RankRow } from "@/features/data/components/RankRow";
import { PersonalRankingPanel } from "@/features/data/components/PersonalRankingPanel";
import { EntryHistoryPanel } from "@/features/data/components/EntryHistoryPanel";
import { PerformanceSummaryCard } from "@/features/data/components/PerformanceSummaryCard";
import { LevelHistoryPanel } from "@/features/data/components/LevelHistoryPanel";
import { LevelDistributionPanel } from "@/features/data/components/LevelDistributionPanel";
import type {
  DistributionBin,
  EntryHistoryRow,
  LevelHistoryPoint,
  PerformanceSummary,
  PeriodFilter,
  RankedUser,
  SelfRankSummary,
} from "@/features/data/types/data";
import type { TournamentTier } from "@/features/tournaments/types/tournament";

// renderToStaticMarkup のラッパ。HTML 文字列を返す。
function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

// 8 階級すべて空の tierRankings を作る補助（PersonalRankingPanel 用）。
function emptyTierRankings(): Record<TournamentTier, RankedUser[]> {
  return {
    A: [],
    AB: [],
    B: [],
    BC: [],
    C: [],
    CD: [],
    D: [],
    DE: [],
  };
}

// RankedUser を 1 件組み立てる補助。
function makeRankedUser(overrides: Partial<RankedUser> = {}): RankedUser {
  return {
    id: "u1",
    loginId: "login-1",
    nickname: "テスト太郎",
    avatarUrl: null,
    granLevel: 500,
    ratedMatchCount: 10,
    createdAt: "2024-01-01 00:00:00",
    rank: 1,
    tier: "C",
    classLabel: "C級",
    ...overrides,
  };
}

// 全期間のみ有効な periodLowerBounds（LevelHistoryPanel 用）。
const PERIOD_LOWER_BOUNDS: Record<PeriodFilter, string | null> = {
  ALL: null,
  "1Y": "2024-01-01 00:00:00",
  "6M": "2024-07-01 00:00:00",
  "3M": "2024-10-01 00:00:00",
};

describe("EntryHistoryPanel の表示分岐", () => {
  const sampleRow: EntryHistoryRow = {
    tournamentTitle: "春季大会",
    eventDate: "2024-05-01",
    category: "SINGLES",
    tier: "C",
    rankType: "T1_WINNER",
    granLevelDiff: 5,
  };

  it("entryHistory が空のとき空状態（履歴未記録）を表示し、エラー表示はしない", () => {
    const html = render(<EntryHistoryPanel entryHistory={[]} />);

    expect(html).toContain("出場履歴が未記録です");
    // エラー表示（ErrorRetry）の文言は出ない。
    expect(html).not.toContain("出場履歴の取得に失敗しました。");
    expect(html).not.toContain('role="alert"');
  });

  it("error=true のときは ErrorRetry（エラー文言 + 再取得ボタン）を表示する", () => {
    const html = render(
      <EntryHistoryPanel entryHistory={[sampleRow]} error onRetry={() => {}} />,
    );

    expect(html).toContain("出場履歴の取得に失敗しました。");
    expect(html).toContain("再取得");
    expect(html).toContain('role="alert"');
    // エラー時は一覧（大会名）を描画しない。
    expect(html).not.toContain("春季大会");
    // 空状態の文言も出ない（エラー分岐が優先）。
    expect(html).not.toContain("出場履歴が未記録です");
  });

  it("error=true かつ onRetry 未指定でもエラー文言は表示される", () => {
    const html = render(<EntryHistoryPanel entryHistory={[sampleRow]} error />);

    expect(html).toContain("出場履歴の取得に失敗しました。");
    expect(html).toContain('role="alert"');
  });

  it("履歴はあるが初期描画では条件一致なしメッセージを出さない（フィルタ未適用）", () => {
    const html = render(<EntryHistoryPanel entryHistory={[sampleRow]} />);

    expect(html).toContain("春季大会");
    expect(html).not.toContain("条件に一致する履歴がありません");
  });
});

describe("RankRow / PersonalRankingPanel の自身行識別", () => {
  it("RankRow は isSelf のとき音声読み上げ用テキスト「（あなた）」と「あなた」バッジを付与する", () => {
    const html = render(
      <RankRow
        rank={1}
        nickname="テスト太郎"
        avatarUrl={null}
        granLevel={500}
        isSelf
      />,
    );

    // 音声読み上げ用の識別テキスト。
    expect(html).toContain("（あなた）");
    // 視覚バッジ。
    expect(html).toContain(">あなた<");
    // 自身行マーク。
    expect(html).toContain('aria-current="true"');
  });

  it("RankRow は isSelf でないとき識別テキストを付与しない", () => {
    const html = render(
      <RankRow
        rank={2}
        nickname="他人花子"
        avatarUrl={null}
        granLevel={400}
        isSelf={false}
      />,
    );

    expect(html).not.toContain("（あなた）");
    expect(html).not.toContain('aria-current="true"');
  });

  it("PersonalRankingPanel は selfLoginId に一致する行へ識別テキストを付与する", () => {
    const self = makeRankedUser({
      id: "self",
      loginId: "self-login",
      nickname: "自分選手",
      rank: 1,
    });
    const other = makeRankedUser({
      id: "other",
      loginId: "other-login",
      nickname: "相手選手",
      rank: 2,
    });
    const summary: SelfRankSummary = {
      granLevel: 500,
      isCalibrated: true,
      totalCount: 2,
      overallRank: 1,
      tier: "C",
      classLabel: "C級",
    };

    const html = render(
      <PersonalRankingPanel
        personalRanking={[self, other]}
        tierRankings={emptyTierRankings()}
        selfRankSummary={summary}
        selfLoginId="self-login"
      />,
    );

    expect(html).toContain("自分選手");
    expect(html).toContain("相手選手");
    // 自身行にのみ識別テキストが付く（1 回だけ出現）。
    const occurrences = html.split("（あなた）").length - 1;
    expect(occurrences).toBe(1);
  });

  it("PersonalRankingPanel は査定中（overallRank=null）のとき順位を「対象外」表示にする", () => {
    const summary: SelfRankSummary = {
      granLevel: 480,
      isCalibrated: false,
      totalCount: 3,
      overallRank: null,
      tier: "C",
      classLabel: "査定中",
    };

    const html = render(
      <PersonalRankingPanel
        personalRanking={[makeRankedUser()]}
        tierRankings={emptyTierRankings()}
        selfRankSummary={summary}
        selfLoginId="no-match"
      />,
    );

    expect(html).toContain("対象外");
    expect(html).toContain("査定中");
  });
});

describe("PerformanceSummaryCard の表示分岐", () => {
  const baseSummary: PerformanceSummary = {
    totalEntries: 12,
    winCount: 3,
    runnerUpCount: 2,
    winRate: null,
  };

  it("winRate が null のとき勝率にダッシュ「—」を表示する", () => {
    const html = render(
      <PerformanceSummaryCard performanceSummary={baseSummary} />,
    );

    expect(html).toContain("—");
    expect(html).toContain("勝率は未算出です");
    // 件数指標はそのまま表示される。
    expect(html).toContain("総出場回数");
  });

  it("winRate が数値のとき百分率で表示し、ダッシュは出さない", () => {
    const html = render(
      <PerformanceSummaryCard
        performanceSummary={{ ...baseSummary, winRate: 0.25 }}
      />,
    );

    expect(html).toContain("25.0%");
    expect(html).not.toContain("勝率は未算出です");
  });

  it("error=true のとき ErrorRetry を表示し、指標値は描画しない", () => {
    const html = render(
      <PerformanceSummaryCard
        performanceSummary={baseSummary}
        error
        onRetry={() => {}}
      />,
    );

    expect(html).toContain("成績サマリの取得に失敗しました。");
    expect(html).toContain("再取得");
    expect(html).toContain('role="alert"');
    // 指標ラベルは描画しない。
    expect(html).not.toContain("総出場回数");
  });
});

describe("LevelHistoryPanel の表示分岐", () => {
  const samplePoint: LevelHistoryPoint = {
    tournamentTitle: "夏季大会",
    preGranLevel: 480,
    granLevelDiff: 20,
    postGranLevel: 500,
    recordedAt: "2024-08-01 12:00:00",
  };

  it("levelHistory が空のとき空状態（履歴なし）を表示する（5.6）", () => {
    const html = render(
      <LevelHistoryPanel
        levelHistory={[]}
        periodLowerBounds={PERIOD_LOWER_BOUNDS}
      />,
    );

    expect(html).toContain("レベル推移の履歴がありません");
    // エラー表示はしない。
    expect(html).not.toContain("レベル推移データの取得に失敗しました。");
  });

  it("error=true のとき ErrorRetry を表示する（5.8）", () => {
    const html = render(
      <LevelHistoryPanel
        levelHistory={[samplePoint]}
        periodLowerBounds={PERIOD_LOWER_BOUNDS}
        error
        onRetry={() => {}}
      />,
    );

    expect(html).toContain("レベル推移データの取得に失敗しました。");
    expect(html).toContain("再取得");
    expect(html).toContain('role="alert"');
    // エラー時はグラフ/表（大会名）を描画しない。
    expect(html).not.toContain("夏季大会");
    expect(html).not.toContain("レベル推移の履歴がありません");
  });
});

describe("LevelDistributionPanel の自身位置インジケータ分岐", () => {
  // 8 区間ぶんの分布（count は適当に付与）。
  const distribution: DistributionBin[] = [
    { tier: "A", lower: 850, upper: 999, count: 1 },
    { tier: "AB", lower: 750, upper: 849, count: 2 },
    { tier: "B", lower: 650, upper: 749, count: 3 },
    { tier: "BC", lower: 550, upper: 649, count: 2 },
    { tier: "C", lower: 450, upper: 549, count: 4 },
    { tier: "CD", lower: 350, upper: 449, count: 1 },
    { tier: "D", lower: 250, upper: 349, count: 1 },
    { tier: "DE", lower: 100, upper: 249, count: 1 },
  ];

  it("未査定（isCalibrated=false）時は位置インジケータを隠し説明テキストを表示する（7.5）", () => {
    const summary: SelfRankSummary = {
      granLevel: 480,
      isCalibrated: false,
      totalCount: 15,
      overallRank: null,
      tier: "C",
      classLabel: "査定中",
    };

    const html = render(
      <LevelDistributionPanel
        distribution={distribution}
        selfRankSummary={summary}
      />,
    );

    // 未確定の説明テキスト。
    expect(html).toContain("分布上の位置は確定していません");
    // 査定済み向けの位置インジケータ説明は出ない。
    expect(html).not.toContain("該当区間を強調表示しています");
    // 自身区間の sr-only ラベルも出ない。
    expect(html).not.toContain("（あなたの区間）");
  });

  it("査定済（isCalibrated=true）時は位置インジケータ説明と自身区間ラベルを表示する（7.4）", () => {
    const summary: SelfRankSummary = {
      granLevel: 480,
      isCalibrated: true,
      totalCount: 15,
      overallRank: 5,
      tier: "C",
      classLabel: "C級",
    };

    const html = render(
      <LevelDistributionPanel
        distribution={distribution}
        selfRankSummary={summary}
      />,
    );

    expect(html).toContain("該当区間を強調表示しています");
    expect(html).toContain("（あなたの区間）");
    expect(html).not.toContain("分布上の位置は確定していません");
  });

  it("対象母集団が 0 名のとき空状態を表示する（7.7）", () => {
    const emptyDistribution: DistributionBin[] = distribution.map((bin) => ({
      ...bin,
      count: 0,
    }));
    const summary: SelfRankSummary = {
      granLevel: 480,
      isCalibrated: true,
      totalCount: 0,
      overallRank: null,
      tier: "C",
      classLabel: "C級",
    };

    const html = render(
      <LevelDistributionPanel
        distribution={emptyDistribution}
        selfRankSummary={summary}
      />,
    );

    expect(html).toContain("レベル分布を表示できません");
  });
});
