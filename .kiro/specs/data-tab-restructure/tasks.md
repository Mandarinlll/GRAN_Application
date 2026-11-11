# Implementation Plan: データタブ再構成 (data-tab-restructure)

## Overview

ナビゲーション「データ」タブを実装し、マイデータ（`/data/me`）、出場データ（`/data/participations`）、ランキング（`/data/ranking`）の3画面を提供する。実装言語は TypeScript（Next.js 16 / React 19 / Tailwind / `node:sqlite`）。

進め方は次のとおり。

1. テスト基盤とDBスキーマを整える。
2. DB非依存の純粋関数（`src/features/data/utils/`）を作り、プロパティテストで検証する。
3. SQLを `dataRepository` に集約し、認証ガード付きのRoute Handlerで公開する。
4. 取得フックと共通UIを作り、3画面を組み立てて配線する。
5. シードデータとドキュメントを更新する。

## Tasks

- [x] 1. テスト基盤とDBスキーマの準備
  - [x] 1.1 テスト基盤（vitest / fast-check）を追加する
    - `package.json` の devDependencies に `vitest` と `fast-check` をバージョン固定で追加し、`"test": "vitest --run"` を scripts に追加する
    - `vitest.config.ts` を作成し、パスエイリアス `@/` を `tsconfig` と一致させる
    - _Requirements: 設計書「Testing Strategy」_

  - [x] 1.2 `src/lib/db.ts` にスキーマ変更を追加する
    - `ensureColumn(table, column, ddl)`（`PRAGMA table_info` で存在確認後 `ALTER TABLE ADD COLUMN`）を `createDatabase()` に追加し、冪等に適用する
    - `tournament_series` テーブルを作成し、`tournaments` に `surface` / `series_id` / `gender_division` を NULL 許容で追加する
    - `tournament_matches` と `tournament_results`（`UNIQUE (tournament_id, user_id)`）を作成する
    - インデックス（`idx_entry_members_user`、`idx_results_user_recorded`、`idx_matches_entry1`、`idx_matches_entry2`）を作成する
    - _Requirements: 3.1, 4.1, 5.8, 6.9_

  - [ ]* 1.3 スキーマ適用の冪等性テストを書く
    - `:memory:` DB で `createDatabase()` 相当の処理を2回実行しても失敗せず、追加カラムが1つずつであることを確認する
    - _Requirements: 5.8_

- [x] 2. 純粋関数（`src/features/data/utils/`）の実装
  - [x] 2.1 DTO型と階級・勝率・季節の関数を実装する
    - `types/dto.ts` に設計書の DTO 型（`LevelDto`、`HistoryRowDto`、`ChartPointDto`、`RecentMatchDto`、`ParticipationRowDto`、`ParticipationDetailDto`、`RankingRowDto`）と `GenderDivision` / `RankingCategory` / `Surface` / `ResultRank` を定義する
    - `tier.ts`（`TIER_ORDER`、`tierLowerBound`、`tierUpperBound`、`nextTier`、`computePromotion`。階級判定は既存 `granLevelToTier` を利用）を実装する
    - `winRate.ts`（`winRatePercent1`、`winRatePercentInt`、`formatRate1`）と `season.ts`（`seasonOf`、`seasonOfDate`）を実装する
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 4.1, 5.4, 5.6, 5.7_

  - [ ]* 2.2 階級・勝率・季節のプロパティテストを書く
    - **Property 1: 階級判定と昇格情報の整合**
    - **Property 2: 勝率の算出と表示**
    - **Property 4: 季節は月の全域写像**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 4.1, 5.4, 5.6, 5.7**

  - [x] 2.3 集計・履歴・ページングの関数を実装する
    - `aggregate.ts`（`DecidedMatch`、`Bucket`、`aggregateByDimension`。固定区分は0件でも全区分を返し、欠損は「未設定」、`opponent` は団体戦のみ）を実装する
    - `history.ts`（`sortHistoryDesc`、`toChartSeries`、`formatDelta`、直近5件を選ぶ `selectRecentMatches`）を実装する
    - `pagination.ts`（`slicePage`）を実装する
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.8, 4.2, 5.2, 5.3, 5.4, 5.5, 5.8, 5.9, 6.3, 7.4, 8.10_

  - [ ]* 2.4 集計・履歴・ページングのプロパティテストを書く
    - **Property 3: 条件別集計は試合を丁度1区分に分類する**
    - **Property 5: ページングは全件を過不足なく分割する**
    - **Property 6: 履歴は新しい順、グラフは全件を古い順**
    - **Property 7: 変動値の表記**
    - **Property 8: 直近試合は最大5件で新しい順**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.8, 4.2, 5.2, 5.3, 5.4, 5.5, 5.8, 5.9, 6.3, 7.4, 8.10**

  - [x] 2.5 出場履歴と対戦相手表示の関数を実装する
    - `participation.ts`（`ParticipationFilter`、`filterParticipations`、`sortParticipations`、`resultLabel`）を実装する
    - `opponent.ts`（`opponentLabel`。ゲストは「ゲスト」、PENDING は「未定」、団体戦はチーム名優先、個人/ペアはニックネームを「・」連結）を実装する
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 7.2, 11.5, 11.6_

  - [ ]* 2.6 出場履歴・対戦相手表示のプロパティテストを書く
    - **Property 9: 出場履歴の絞り込みと並べ替え**
    - **Property 16: 対戦相手の匿名化**
    - **Validates: Requirements 6.1, 6.4, 6.5, 11.5, 11.6**

  - [x] 2.7 ランキングの関数を実装する
    - `ranking.ts`（`rankWithinTier`、`rankByCompetition`、`selectCategoryPool`、`toRankingRowDto`）を実装する
    - 直近勝率の比較は整数の交差乗算で行い、`recentTotal = 0` は最下位扱いにする
    - `toRankingRowDto` は公開4項目と `isMe` のみを返し、`userId` はクライアントへ渡さない
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 9.2, 9.3, 9.4, 9.7, 9.8, 11.4_

  - [ ]* 2.8 ランキングのプロパティテストを書く
    - **Property 12: 階級内順位の整列とタイブレーク**
    - **Property 13: 種目別順位は競技順位（同値は同一順位）**
    - **Property 14: 種目別の集計単位と階級別との一致**
    - **Property 15: 他ユーザー公開情報の限定**
    - **Validates: Requirements 8.3, 8.5, 8.6, 8.8, 8.9, 9.2, 9.4, 9.7, 9.8, 11.4**

- [x] 3. Checkpoint - 純粋関数とスキーマの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. サーバー層（認証ガード・リポジトリ・Route Handler）
  - [x] 4.1 認証ガードと共通ハンドララッパを実装する
    - `server/authGuard.ts` に `requireSession`（未ログインは401）と `assertSelf`（`userId` 不一致は403）を実装する
    - `server/handlers.ts` に、エラー形式 `{ error: { code, message } }`（401/403/400/404/500）への変換、`Cache-Control: no-store` 付与、zod による入力検証の共通処理を実装する
    - DB例外の詳細はログのみに出し、レスポンスに含めない
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 4.2 `dataRepository` を実装する
    - `server/dataRepository.ts` に `createDataRepository(db: DatabaseSync)` を実装する
    - GRANレベル、履歴（`recorded_at DESC, rowid DESC` のページング、`offset=0` 時のグラフ用全件）、通算勝敗と直近試合、条件別勝率用の `DecidedMatch` 取得を実装する
    - 出場履歴（`CONFIRMED` / `ATTENDED` かつ開催日を迎えたもののみ、結果は LEFT JOIN）と出場詳細（ラウンド昇順、未出場は NOT_FOUND）を実装する
    - 階級別・種目別ランキング（`is_level_calibrated = 1 AND status = 'ACTIVE'`、直近10試合の勝敗取得、`nickname, avatar_url, gran_level, id` のみ SELECT）を実装する
    - 不戦（`entry2_id` NULL）や範囲外データは集計から除外し、対戦相手の `real_name` / `guest_name` は SELECT しない
    - _Requirements: 2.1, 3.1, 3.8, 4.1, 4.2, 5.9, 6.1, 6.9, 7.3, 8.3, 8.5, 8.8, 8.9, 9.7, 9.8, 11.1, 11.5, 11.6_

  - [ ]* 4.3 リポジトリのプロパティテストを書く（インメモリDB）
    - **Property 10: キャンセル済み・キャンセル待ちは出場履歴に現れない**
    - **Property 11: 出場詳細の試合はラウンド昇順**
    - `new DatabaseSync(":memory:")` に必要テーブルを作成し、`createDataRepository(db)` へ注入して実行する
    - **Validates: Requirements 6.9, 7.3**

  - [x] 4.4 `/api/data/**` のRoute Handlerを実装する
    - `src/app/api/data/` 配下に `me/level`、`me/gran-history`、`me/record`、`me/win-rate`、`participations`、`participations/[tournamentId]`、`ranking/tier`、`ranking/category` の `GET` を実装する
    - 各ハンドラは `requireSession` と `assertSelf` を通し、クエリ（`dimension`、`tier`、`category`、`order`、`offset`、`limit`）を zod で検証する
    - 設計書の既定値（履歴 limit 20・最大50、ランキング limit 50）を適用する
    - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 11.1, 11.2, 11.3_

  - [ ]* 4.5 Route Handlerの例示テストを書く
    - 未ログイン→401、`userId` 不一致→403、未出場大会の詳細→404、自分のデータのみ返却を確認する
    - `next/headers` の `cookies` をモックして実行する
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 5. Checkpoint - サーバー層の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. クライアント層（フック・共通UI・3画面）
  - [x] 6.1 取得フックと共通状態コンポーネントを実装する
    - `hooks/useRemoteResource.ts` に10秒タイムアウト（`AbortController`）、`retry()`、`consecutiveFailures`、`keepStaleOnError` を実装する
    - `components/RegionState.tsx` に Skeleton / ErrorPanel（再試行ボタン、3回連続失敗時の追加メッセージ）/ EmptyState を実装する
    - 本文 14px 以上、注釈 12px 以上、ダークモード用トークン（`dark:` 併記）を使う
    - _Requirements: 2.7, 2.8, 2.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9_

  - [ ]* 6.2 `useRemoteResource` の例示テストを書く
    - フェイクタイマーで10秒タイムアウト、3回連続失敗、`keepStaleOnError` の有無を確認する
    - _Requirements: 2.9, 10.2, 10.3, 10.4_

  - [x] 6.3 データタブの共通レイアウトとナビゲーションを実装する
    - `navConfig.ts` の `data` 項目を `href: "/data/me"`、`implemented: true` に変更する
    - `components/DataTabs.tsx`（マイデータ / 出場データ / ランキングの順、`aria-current="page"`、下線と背景色で強調）を実装する
    - `src/app/(user)/data/layout.tsx`（認証チェック、`AppShell activeId="data"`、`DataTabs`、`max-w-4xl mx-auto px-4 py-6 pb-24`）と `page.tsx`（`/data/me` へ redirect）を実装する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 6.4 マイデータ画面を実装する
    - `components/me/` に `LevelCard`（階級、昇格差、進捗バー、査定前表示、A級表示）、`GranHistory`、`GranChart`（自前SVG、点のフォーカス選択、全値を `<details>` の表で併記）、`RecordSummary`、`RecentMatches`（勝/敗を文字と色で併用）、`WinRateByCondition`（6条件タブ、整数%と横棒）を実装する
    - 履歴は20件ずつ「もっと見る」で追加し、追加失敗時は表示済み行を保持する
    - `src/app/(user)/data/me/page.tsx` で認証チェックを行い、各コンポーネントを配線する（出場データへのリンクを含む）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.6, 5.7, 5.10, 5.11, 10.6, 10.7_

  - [x] 6.5 出場データ画面を実装する
    - `components/participations/` に `ParticipationFilters`、`ParticipationTable`（md以上は表、md未満は3項目のカード行、行は `role="button"` `tabIndex=0`、`min-h-[44px]`）、`ParticipationDetail`（`role="dialog"` `aria-modal`、Esc・戻る・閉じるボタンで閉じ、フォーカス復帰、`history.pushState`）、`ParticipationView` を実装する
    - 未確定の結果・スコア・勝敗・GRAN変動は未確定表示にする
    - 0件時は大会日程へのリンク、絞り込み0件時は条件解除ボタンを表示する
    - `src/app/(user)/data/participations/page.tsx` で認証チェックを行い配線する
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 6.6 ランキング画面を実装する
    - `components/ranking/` に `RankingTable`（自分の行を強調、アイコン・ニックネーム・GRANレベル、種目別は所属階級も表示）と `RankingView` を実装する
    - 上部1か所に階級別 / 種目別の切替を置き、階級タブは A, AB, B, BC, C, CD, D, DE の順、種目タブは男子・女子・混合（初期は男子）にする
    - 選択状態 `{ mode, tier, category }` を親の `useState` に保持し、初期階級は `granLevelToTier(currentUser.granLevel)` にする
    - 「N位 / M人」表示、50件単位の「もっと見る」、空状態、`keepStaleOnError` による直前順位表の保持を実装する
    - `src/app/(user)/data/ranking/page.tsx` で認証チェックを行い配線する
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.10, 8.11, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.9, 9.10_

  - [ ]* 6.7 コンポーネントの例示テストを書く
    - タブの順序と `aria-current`、勝敗の文字+色併用、行のキーボード操作（Enter/Space）、ダイアログの Esc / 戻る / フォーカス復帰、ランキングのモード切替後の選択状態復元を確認する
    - `navConfig` の `data` 項目（`implemented: true`、`href: "/data/me"`）を確認する
    - UI部品のテストに必要な場合のみ `@testing-library/react` と `jsdom` をバージョン固定で追加する
    - _Requirements: 1.1, 1.4, 4.4, 7.5, 7.6, 9.6_

- [x] 7. シードデータとドキュメントの更新
  - [x] 7.1 `scripts/seed.ts` にサンプルデータを追加する
    - 試合、結果、シリーズ、サーフェス、性別区分を含むデータを投入する
    - ゲスト、不戦、未確定結果、引き分け、同値レベルのケースを含める
    - _Requirements: 4.6, 5.8, 6.9, 7.9, 8.5, 9.2, 11.6_

  - [x] 7.2 `docs/db-schema.md` を更新する
    - 追加テーブル・カラム（`tournament_series`、`surface`、`series_id`、`gender_division`）、`tournament_results` の `UNIQUE (tournament_id, user_id)`、実DBの `declared_class` との差異を反映する
    - _Requirements: 5.8_

- [x] 8. Final checkpoint - すべてのテストとビルドの確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きのサブタスクは任意で、MVP を優先する場合はスキップできる
- 各タスクは要件番号で追跡できる
- プロパティテストは `fc.assert(..., { numRuns: 100 })` 以上で実行し、`// Feature: data-tab-restructure, Property {番号}: {名称}` のタグコメントを付ける
- ダーク時のコントラスト、320px幅の表示、スクリーンリーダー読み上げは自動化せず手動確認とする。WCAG準拠の完全な検証には、支援技術による手動テストと専門家レビューが必要
- このワークフローは計画の作成までで、実装は含まない

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "2.7", "4.1"] },
    { "id": 3, "tasks": ["2.4", "2.6", "2.8", "4.2", "6.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "6.2", "6.3"] },
    { "id": 5, "tasks": ["4.5", "6.4", "6.5", "6.6", "7.1", "7.2"] },
    { "id": 6, "tasks": ["6.7"] }
  ]
}
```
