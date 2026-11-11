# Implementation Plan: データタブ（GRAN_Data_Tab）

## Overview

設計書のディレクトリ構成（`src/features/data/{types,utils,server,components}`、`src/app/(user)/data/page.tsx`、`navConfig.ts` 変更）に沿って、ボトムアップで実装する。純粋関数（utils）→ データアクセス層（Repository + guard）→ ビューモデル組み立て（dataViewData）→ ページ/ナビ有効化 → パネルコンポーネント → 結線・検証の順で、各ステップが前段の成果物の上に積み上がる。

SQL は `dataRepository.ts` にのみ閉じ込め SELECT のみとし、入力検証は Zod、Server/Client 境界を厳守、tier 判定は `granLevelToTier` を再利用、重要情報は HTML テキスト化・44px 以上・`aria` 付与、`tournament_results` 未整備時は空配列/ゼロ値へフォールバックする。

設計の Correctness Properties 14 件を、対応する純粋関数・集計結果のプロパティテスト（`fast-check` + `vitest --run`、各最低 100 反復）として落とし込む。テストは既存に明確なテストディレクトリが無いため、対象コードに近接した `__tests__` ディレクトリ（例: `src/features/data/utils/__tests__`）へ配置する。

## Tasks

- [x] 1. テスト基盤とビューモデル型の整備
  - [x] 1.1 vitest / fast-check を devDependency として追加しテスト設定を作成する
    - `package.json` の devDependencies に `vitest` と `fast-check` を追加し、`"test": "vitest --run"` スクリプトを追加する
    - リポジトリルートに `vitest.config.ts` を作成し、`@/` エイリアス（`src/` 解決）と `environment: "node"` を設定する
    - 既存慣習に合わせ、テストは対象コードに近接した `__tests__` ディレクトリへ配置する方針をコメントで明記する
    - _Requirements: 10.1_

  - [x] 1.2 ビューモデル型を定義する（`src/features/data/types/data.ts`）
    - 設計 Data Models の型を定義する: `RankableUser` / `RankedUser` / `TeamRatingRow` / `RankedTeam` / `DistributionBin` / `LevelHistoryPoint` / `EntryHistoryRow` / `PerformanceSummary` / `ResultRank` / `SelfRankSummary` / `PeriodFilter`
    - `TournamentTier` / `TournamentCategory` は `@/features/tournaments/types/tournament` から import する
    - 本名・フリガナ・電話番号・メール・生年月日・個人エントリー者本名の各項目を一切含めない（非公開項目を構造的に排除）
    - _Requirements: 2.2, 2.3, 8.2, 8.4_
    - _Properties: 10_

- [x] 2. 純粋関数ユーティリティの実装（`src/features/data/utils/`）
  - [x] 2.1 ランキング整列・順位付与関数を実装する（`ranking.ts`）
    - `rankUsers(users: RankableUser[]): RankedUser[]` を実装: `gran_level DESC` → `rated_match_count DESC` → `login_id ASC` → `created_at ASC` の安定順序で整列し、1 始まりの順位を付与（同率は同順位）
    - 各要素に `granLevelToTier` / `granLevelToClassLabel` を用いて `tier` / `classLabel` を付与する
    - `currentUser.ts` の `rankInClass` から再利用できるよう純粋関数として公開する
    - _Requirements: 2.1, 2.9, 3.2, 3.6_
    - _Properties: 1_

  - [x]* 2.2 ランキング整列のプロパティテストを書く（`utils/__tests__/ranking.test.ts`）
    - **Property 1: ランキングの安定順序（単調性 + タイブレーク）**
    - `// Feature: data-tab, Property 1: ...` タグを付与し、`fc.assert(..., { numRuns: 100 })` で実行する
    - **Validates: Requirements 2.1, 2.9, 3.2, 3.6**
    - _Properties: 1_

  - [x] 2.3 チーム平均レート算出関数を実装する（`teamRating.ts`）
    - `computeTeamRating(memberLevels: number[]): number | null` を実装: 有効 `gran_level`（100〜999）メンバーの算術平均を四捨五入（`Math.round`）した整数を返し、有効メンバー 0 名なら `null`
    - _Requirements: 4.4_
    - _Properties: 5_

  - [x]* 2.4 チーム平均レートのプロパティテストを書く（`utils/__tests__/teamRating.test.ts`）
    - **Property 5: チーム平均レートの丸め整合**
    - `// Feature: data-tab, Property 5: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 4.4**
    - _Properties: 5_

  - [x] 2.5 レベル分布の区間集計関数を実装する（`distribution.ts`）
    - `buildDistribution(levels: number[]): DistributionBin[]` を実装: 8 段階の規定階級境界（A:850〜999 / AB:750〜849 / … / DE:100〜249）に一致する区間へ件数を集計し、合計は入力件数に一致させる
    - 区間判定は `granLevelToTier` と整合させる
    - _Requirements: 7.1, 7.2_
    - _Properties: 8_

  - [x]* 2.6 レベル分布のプロパティテストを書く（`utils/__tests__/distribution.test.ts`）
    - **Property 8: レベル分布の区間正当性と件数保存**
    - `// Feature: data-tab, Property 8: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 7.1, 7.2**
    - _Properties: 8_

  - [x]* 2.7 tier 判定一致のプロパティテストを書く（`utils/__tests__/tier.test.ts`）
    - **Property 4: tier 判定が granLevelToTier と一致**
    - 本機能の tier 算出（`rankUsers` / `buildDistribution` 由来）が任意の 100〜999 で `granLevelToTier` と一致することを検証する
    - `// Feature: data-tab, Property 4: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 3.3, 7.2**
    - _Properties: 4_

  - [x] 2.8 期間フィルタ境界算出関数を実装する（`period.ts`）
    - `type PeriodFilter = "ALL" | "1Y" | "6M" | "3M"` と `periodLowerBound(period: PeriodFilter, now: string): string | null` を実装: 全期間は `null`、それ以外は `now`（JST 文字列）から 1 年 / 6 ヶ月 / 3 ヶ月前の下限 `recorded_at` を返す
    - _Requirements: 5.4, 5.5_
    - _Properties: 7_

  - [x] 2.9 出場履歴のソート・フィルタ関数を実装する（`entryHistory.ts`）
    - ソート（開催日 / 種目区分 / 成績区分、昇順・降順、ソートキー同値は開催日降順で安定）とフィルタ（種目区分 / 階級）を行う純粋関数を実装する
    - _Requirements: 6.4, 6.5, 6.6_
    - _Properties: 9_

  - [x]* 2.10 出場履歴ソート・フィルタのプロパティテストを書く（`utils/__tests__/entryHistory.test.ts`）
    - **Property 9: 出場履歴のソート安定性とフィルタ健全性**
    - `// Feature: data-tab, Property 9: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 6.4, 6.5, 6.6**
    - _Properties: 9_

- [x] 3. Checkpoint - utils のテストが通ることを確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. データアクセス層の実装（`src/features/data/server/`・SQL は Repository のみ）
  - [x] 4.1 tournament_results 存在ガードを実装する（`tournamentResultsGuard.ts`）
    - `tournamentResultsTableExists(): boolean` を `SELECT name FROM sqlite_master WHERE type='table' AND name='tournament_results' LIMIT 1` で実装する
    - `tournament_results` 依存クエリを安全実行するための `try/catch` ラッパ（例外時にフォールバック値を返す）を提供する
    - _Requirements: 10.1, 10.2_
    - _Properties: 13_

  - [x] 4.2 ランキング・分布系の SELECT を実装する（`dataRepository.ts`）
    - `listPersonalRanking(): RankableUser[]`（`is_level_calibrated = 1` かつ `gran_level BETWEEN 100 AND 999`、設計の安定順序で ORDER BY）
    - `listTierRanking(tier): RankableUser[]`、`listTeamRatingRows(): TeamRatingRow[]`（有効 gran_level メンバーのみ集約）、`listCalibratedLevels(): number[]`、`countUncalibratedUsers(): number` を実装する
    - snake_case 行 → camelCase ビューモデル変換、`db.prepare(...).all()/.get()` の既存作法を踏襲し、SELECT のみ（更新系関数は定義しない）
    - _Requirements: 2.1, 2.10, 3.2, 3.3, 3.7, 4.1, 4.5, 4.6, 7.1, 7.8, 11.1, 11.2_
    - _Properties: 2, 3, 6, 14_

  - [x] 4.3 tournament_results 依存の SELECT を実装する（`dataRepository.ts`）
    - `getLevelHistory(userId): LevelHistoryPoint[]`（`recorded_at` 昇順）、`listEntryHistory(userId): EntryHistoryRow[]`、`getPerformanceSummary(userId): PerformanceSummary`（`totalEntries` / `winCount`=`T1_WINNER` / `runnerUpCount`=`T1_RUNNER_UP`、`winRate` は `null`）を実装する
    - 各関数は冒頭で `tournamentResultsTableExists()` を確認し、非存在または例外時は空配列 / ゼロ値（`winRate` は `null`）へフォールバックする
    - 自身（`userId`）のレコードのみを集計し、他ユーザーを含めない
    - _Requirements: 5.2, 5.3, 6.2, 9.1, 9.2, 10.1, 10.2, 10.4, 11.1, 11.2_
    - _Properties: 11, 12, 13, 14_

  - [x]* 4.4 ランキング母集団除外・階級フィルタ・チーム順序のプロパティテストを書く（`server/__tests__/dataRepository.ranking.test.ts`）
    - シード済みテスト用 SQLite に対し検証する
    - **Property 2: 未査定ユーザーの母集団除外** / **Property 3: 階級フィルタ結果の健全性** / **Property 6: チームランキングの順序と有効メンバー要件**
    - 各プロパティに `// Feature: data-tab, Property N: ...` タグを付与し、`numRuns: 100` で実行する（1 プロパティ = 1 テスト）
    - **Validates: Requirements 2.10, 3.7, 7.8, 3.2, 3.3, 4.1, 4.5, 4.6, 4.7**
    - _Properties: 2, 3, 6_

  - [x]* 4.5 成績サマリ母集団分離・件数集計・履歴昇順のプロパティテストを書く（`server/__tests__/dataRepository.results.test.ts`）
    - テスト用 SQLite に複数ユーザーの `tournament_results` をシードして検証する
    - **Property 7: レベル推移の昇順と期間フィルタの健全性** / **Property 11: 成績サマリの母集団分離** / **Property 12: 成績サマリの件数集計整合**
    - 各プロパティに `// Feature: data-tab, Property N: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 5.3, 5.4, 5.5, 9.1, 9.2**
    - _Properties: 7, 11, 12_

  - [x]* 4.6 未整備フォールバックと副作用非発生のプロパティテストを書く（`server/__tests__/dataRepository.fallback.test.ts`）
    - `tournament_results` 未作成の空 SQLite、および例外を投げるスタブ db を注入する
    - **Property 13: 履歴データ未整備時に例外を投げない**（空配列 / ゼロ値を返す）
    - **Property 14: 閲覧専用（副作用非発生）**（取得系呼び出し前後で各テーブルの `COUNT(*)` と内容が不変）
    - 各プロパティに `// Feature: data-tab, Property N: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 10.1, 10.2, 10.4, 11.1, 11.2**
    - _Properties: 13, 14_

  - [x]* 4.7 非公開プロフィール項目非露出のプロパティテストを書く（`server/__tests__/dataRepository.privacy.test.ts`）
    - **Property 10: 非公開プロフィール項目の非露出**（ユーザー/チームのビューモデルに本名・フリガナ・電話番号・メール・生年月日・個人エントリー者本名を含まない）
    - `// Feature: data-tab, Property 10: ...` タグを付与し、`numRuns: 100` で実行する
    - **Validates: Requirements 2.2, 2.3, 8.2, 8.4**
    - _Properties: 10_

- [x] 5. ビューモデル組み立て（`src/features/data/server/dataViewData.ts`・Server）
  - [x] 5.1 ビューモデル組み立て関数を実装する
    - `dataRepository` の呼び出しと `utils`（`rankUsers` / `computeTeamRating` → `RankedTeam` 整列 / `buildDistribution` / `periodLowerBound`）を組み合わせ、各パネル用のビューモデルと `SelfRankSummary`（査定中は `overallRank = null` / `classLabel = "査定中"`）を組み立てる
    - チーム順位は `computeTeamRating` が `null`（有効メンバー 0）のチームを除外し、`teamRating` 降順・同率はリーダーニックネーム昇順・同順位付与で整列する
    - `getCurrentUser()` 由来の閲覧ユーザー情報を受け取り、自身行ハイライト・自身位置インジケータ用のフラグを付与する
    - _Requirements: 2.5, 2.6, 3.4, 4.7, 7.4, 7.5, 9.1_
    - _Properties: 1, 5, 6, 8_

- [x] 6. ルーティングとナビゲーション有効化
  - [x] 6.1 /data ページ（Server・認証ガード）を実装する（`src/app/(user)/data/page.tsx`）
    - `getCurrentUser()` を呼び `null` なら `redirect("/login")`（既存 `tournaments/page.tsx` パターン踏襲）
    - `dataViewData` から初期データを取得し、`AppShell activeId="data"` でラップして `DataTabView` に props として渡す
    - _Requirements: 1.1, 1.6_

  - [x] 6.2 navConfig の data 項目を有効化する（`src/components/layout/navConfig.ts`）
    - `data` 項目を `href: "/data"` / `implemented: true` に変更する
    - _Requirements: 1.2_

  - [x]* 6.3 認証ガードと navConfig のユニットテストを書く（`__tests__`）
    - セッションなしで `/login` へ redirect すること、`data` 項目が `implemented: true` / `href: "/data"` であることを検証する
    - _Requirements: 1.2, 1.6_

- [x] 7. パネルコンポーネントの実装（`src/features/data/components/`）
  - [x] 7.1 共通 UI（`EmptyState.tsx` / `ErrorRetry.tsx` / `RankRow.tsx`）を実装する
    - `EmptyState`: データ未記録/条件不一致の説明テキストを表示する空状態（Client/Server）
    - `ErrorRetry`: 取得失敗のエラー表示 + 再取得ボタン（Client、44px 以上）
    - `RankRow`: アバター or 代替アイコン、自身行の視覚強調 + 音声読み上げ用識別テキスト、順位/レベルを HTML テキスト化
    - _Requirements: 1.5, 1.7, 2.4, 2.8, 8.1, 10.3_
    - _Properties: 10_

  - [x] 7.2 画面内タブ親 DataTabView を実装する（`DataTabView.tsx`, "use client"）
    - 6 領域（個人/チーム/推移/出場/分布/成績）を `aria-current` 付きで切替、各タブは 44px 以上のタッチターゲット
    - 初期データを props で受け取り各パネルへ振り分ける
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 7.3 個人ランキングパネルを実装する（`PersonalRankingPanel.tsx`）
    - 全体/階級内（8 階級タブ）切替、`RankRow` による一覧、自身行ハイライト、`SelfRankSummary`（順位/総人数/自身レベル、対象外は「対象外」表示）、空状態
    - 公開項目（ニックネーム/アイコン/GRANレベル/順位）のみ表示する
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.4, 3.5_

  - [x] 7.4 チームランキングパネルを実装する（`TeamRankingPanel.tsx`）
    - チーム名/アイコン（未設定はプレースホルダー）/代表者ニックネーム/チームGRANレベル指標/順位の一覧、空状態
    - _Requirements: 4.1, 4.2, 4.3, 4.8, 4.9, 8.3, 8.4_

  - [x] 7.5 レベル推移パネルを実装する（`LevelHistoryPanel.tsx`）
    - 期間フィルタ（全期間/1年/6ヶ月/3ヶ月）、SVG 折れ線グラフ + 各変動点の表併記（pre/diff/post/recorded_at）、0 件/期間内 0 件の空状態、取得失敗時 `ErrorRetry`
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9_

  - [x] 7.6 出場履歴パネルを実装する（`EntryHistoryPanel.tsx`）
    - `entryHistory.ts` を用いたソート（開催日/種目/成績）・フィルタ（種目/階級）、初期は開催日降順、`gran_level_diff` 未記録はプレースホルダー、0 件/条件不一致の空状態、取得失敗時 `ErrorRetry`
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8, 6.9_

  - [x] 7.7 レベル分布パネルを実装する（`LevelDistributionPanel.tsx`）
    - 全体/階級別ヒストグラム（div バー）、各区間の下限/上限/人数の表併記、自身位置インジケータ（未査定/未確定時は非表示 + 説明テキスト）、空状態
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 7.8 成績サマリカードを実装する（`PerformanceSummaryCard.tsx`）
    - 総出場/優勝/準優勝を表示、0 件時は 0 表示、`winRate` が `null` のときダッシュ（`—`）表示、取得失敗時 `ErrorRetry`
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

  - [x]* 7.9 パネルの分岐ユニットテストを書く（`components/__tests__`）
    - 空状態 vs エラー + 再取得の表示分岐、自身行の識別テキスト付与、勝率 `null` のダッシュ表示、未査定時の位置インジケータ非表示を検証する
    - _Requirements: 2.4, 2.6, 5.6, 5.8, 6.7, 7.5, 9.3, 9.5, 10.3_

- [x] 8. 結線と最終検証
  - [x] 8.1 ページ・ビューモデル・パネルを結線する
    - `page.tsx` → `dataViewData` → `DataTabView` → 各パネルの props 受け渡しを確認し、未査定除外・自身ハイライト・空状態/フォールバックが end-to-end で成立するよう結線する
    - 孤立コードが無いことを確認する
    - _Requirements: 1.1, 1.2, 10.2, 10.3, 10.4_

  - [x] 8.2 型チェックとテストを実行して検証する
    - `npx tsc --noEmit` で型エラーが無いことを確認する
    - `npm run test`（`vitest --run`）で全ユニット/プロパティテストが通ることを確認する
    - _Requirements: 10.1, 11.1, 11.2_

- [x] 9. Final checkpoint - すべてのテストと型チェックが通ることを確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きサブタスクはテスト（ユニット/プロパティ）で任意。MVP では省略可能だが、Correctness Properties 検証のため実施を推奨する。
- 各タスクは特定の requirements 条項と、該当する設計プロパティ（`_Properties: N_`）を参照する。
- SQL は `dataRepository.ts` にのみ存在し SELECT のみ（Property 14 / Requirement 11）。
- `tournament_results` 未整備でも 4.1 のガードにより空状態へフォールバックし、ビルド・テストが通る（Property 13 / Requirement 10）。
- テストは対象コードに近接した `__tests__` ディレクトリへ配置する（プロジェクトに既存のテストディレクトリ慣習が無いため）。
- プロパティテストは `fast-check` + `vitest --run`、各最低 100 反復（`numRuns: 100`）、`// Feature: data-tab, Property N: ...` タグ付き。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.5", "2.8", "2.9", "4.1", "6.2"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "2.7", "2.10", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5", "4.6", "4.7", "5.1"] },
    { "id": 4, "tasks": ["6.1", "7.1"] },
    { "id": 5, "tasks": ["6.3", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8"] },
    { "id": 6, "tasks": ["7.9", "8.1"] },
    { "id": 7, "tasks": ["8.2"] }
  ]
}
```
