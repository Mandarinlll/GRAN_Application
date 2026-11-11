# 設計書: データタブ再構成 (data-tab-restructure)

## Overview

ナビゲーション「データ」タブ（`src/components/layout/navConfig.ts` の `id: "data"`、現状 `href: "#"` / `implemented: false`）を実装し、次の3画面を提供する。

| 画面 | URL | 役割 |
| --- | --- | --- |
| マイデータ | `/data/me` | 所属階級・昇格までの差、GRANレベル推移、通算勝敗、直近試合、条件別勝率 |
| 出場データ | `/data/participations` | 通算の出場履歴（表）と出場詳細 |
| ランキング | `/data/ranking` | 階級別・種目別のGRANレベル順位 |

### 既存コードベースとの整合（調査結果）

- スタック: Next.js 16 (App Router) / React 19 / Tailwind 3.4 / zod / jose。DBは `node:sqlite`（`src/lib/db.ts`、同期API、日時はJST文字列保存）。グラフ/テストライブラリは未導入。
- 認証: `getSession()`（`src/lib/session.ts`）、`getCurrentUser()`（`src/features/auth/server/currentUser.ts`）。未ログインは各ページで `redirect("/login")`（`tournaments/page.tsx` と同方式）。
- 階級判定: `granLevelToTier()`（`src/features/auth/utils/classLabel.ts`）が既に「下限値による連続境界」（A≥850, AB≥750, B≥650, BC≥550, C≥450, CD≥350, D≥250, DE<250）を実装済み。本機能もこれを唯一の基準にする。
- 共通シェル: `AppShell`（`activeId` を受け取る）。画面幅はデータ・統計画面として `max-w-4xl`（`docs/ui-design-system.md` 2.3）。
- DB: `tournament_matches` / `tournament_results` は `docs/db-schema.md` に定義があるが、`src/lib/db.ts` にはまだ**作成されていない**。`tournaments` に `surface` / 大会シリーズが無い。`users` の申告階級カラムは実DBでは `declared_class`（docsは `declared_tier`）。
- ダークモード: `docs/ui-design-system.md` は `dark:` トークンを定める。現状の `tailwind.config.ts` に `darkMode` 指定は無く既存コードにも `dark:` は無い（Tailwind既定の `media` = OS連動）。本機能は `dark:` クラスを併記して実装し、`darkMode` の切替方式は設定画面（未実装）側の責務として変更しない。

### 設計方針

1. 集計・順位・フォーマットなどのロジックは**DB非依存の純粋関数**として `src/features/data/utils/` に集約し、プロパティベーステスト対象にする。
2. SQLは `src/features/data/server/dataRepository.ts` に集約し、`DatabaseSync` を引数注入できる形にしてインメモリDBでテスト可能にする。
3. データ取得はRoute Handler（`/api/data/...`）+ クライアント側の共通フック。領域ごとに独立したローディング/エラー/再試行を実現する（要件10）。
4. 新規依存はテスト用（vitest, fast-check）のみ。グラフは自前SVGで描画する（依存追加なし）。

### 未確定事項の確定（要件書「前提と未確定事項」への回答）

| 項目 | 決定 | 根拠 |
| --- | --- | --- |
| サーフェス | `tournaments.surface` 追加（`HARD` / `CLAY` / `ARTIFICIAL_GRASS` / `OTHER`、NULL可）。NULLは「未設定」に集計 | 要件5.8。既存データを壊さないNULL許容 |
| 大会シリーズ | 新テーブル `tournament_series(id, name)` と `tournaments.series_id`（NULL可・FK）。NULLは「未設定」 | 名称変更を1箇所で反映できる正規化 |
| 季節 | `event_date` の月から導出。春3–5/夏6–8/秋9–11/冬12–2。DBカラムは持たない | 要件の用語集どおり。純粋関数 `seasonOf(month)` |
| 昇格ポイント境界 | `granLevelToTier` の下限値を採用。Promotion_Threshold = 次階級の下限値（DE→D: 250, D→CD: 350, CD→C: 450, C→BC: 550, BC→B: 650, B→AB: 750, AB→A: 850。Aは最上位で閾値なし）。差 = 閾値 − 現在値（常に1以上）。進捗 = (現在値 − 現階級下限) ÷ (閾値 − 現階級下限) を0–100%に丸め | docsの査定レンジは重複しているが（例: A 850–999 / AB 750–870）、それは**初期査定の目安**。実判定は既存実装の連続境界で行われており、表示と一貫させる |
| 種目別ランキングの集計単位 | **性別による区分**。順位の元は常に `users.gran_level` の1値。男子=`gender='MALE'`、女子=`gender='FEMALE'`、混合=全ユーザー（性別未設定・OTHER含む） | 種目別レーティングはDBに存在せず、要件9.7（階級別と同じ値）を満たす最小構成。種目別Eloは将来拡張 |
| 団体戦の個人別勝敗粒度 | **試合（`tournament_matches` 1行＝エントリー対エントリー）単位**で集計。ユーザーは `entry_members`（`REGISTERED`）に含まれるエントリーの勝敗を自分の勝敗とする。個人ペア単位の子テーブル（`tournament_match_games`）は将来拡張とし、本機能では作らない | 管理者要件で粒度が未決。要件5.5が「団体戦の対戦チーム単位」であり、チーム単位で要件を全て満たせる |
| 引き分け | 勝者未設定の `FINISHED` 試合は勝敗集計から除外（詳細表示のみ「引き分け」と表示）。集計対象を「勝者が確定した FINISHED 試合」に限り、要件4.1の `勝利+敗北=試合数` を保証 | テニスに引き分けは通常無く、データ不備を統計に混ぜない |
| 「種目」の定義（統計/絞り込み） | 大会の `category` から `MEN_TEAM→男子`, `WOMEN_TEAM→女子`, `MIX_TEAM→混合`。`SINGLES`/`DOUBLES` は性別が分からないため `tournaments.gender_division`（`MEN`/`WOMEN`/`MIXED`、NULL可）を追加して参照。NULLは「未設定」区分（試合があるときのみ表示） | `category` だけでは単・複の男女が判別できないため |

> 種目の意味は2種類ある。**統計・出場履歴の種目**は大会の部門（上表）、**ランキングの種目**はユーザーの性別区分である。UI上の名称は同じ「男子/女子/混合」だが、混同しないよう型を `GenderDivision`（大会側）と `RankingCategory`（ランキング側）に分ける。

## Architecture

```mermaid
flowchart TD
  subgraph Client[ブラウザ]
    Tabs[DataTabs]
    Me[MyData 各リージョン]
    Part[ParticipationTable + Detail]
    Rank[RankingView]
    Hook[useRemoteResource<br/>10秒タイムアウト/再試行]
  end
  subgraph Server[Next.js サーバー]
    Pages["/data/me, /data/participations, /data/ranking<br/>(Server Component: 認証ガード + AppShell)"]
    API["/api/data/** Route Handlers"]
    Guard[requireSession / assertSelf]
    Repo[dataRepository<br/>(SQL)]
    Utils[utils: tier, winRate, aggregate,<br/>ranking, pagination, opponent]
  end
  DB[(SQLite data/gran.db)]
  Me --> Hook
  Part --> Hook
  Rank --> Hook
  Hook --> API
  Pages --> Tabs
  API --> Guard --> Repo --> DB
  Repo --> Utils
```

### ルーティングとレイアウト

```
src/app/(user)/data/
  layout.tsx            # 認証 + AppShell(activeId="data") + DataTabs + max-w-4xl
  page.tsx              # /data -> redirect("/data/me")
  me/page.tsx
  participations/page.tsx
  ranking/page.tsx
src/app/api/data/
  me/level/route.ts
  me/gran-history/route.ts
  me/record/route.ts
  me/win-rate/route.ts
  participations/route.ts
  participations/[tournamentId]/route.ts
  ranking/tier/route.ts
  ranking/category/route.ts
```

- Next.jsのレイアウトは画面遷移で再実行されないため、認証チェックは `layout.tsx` と**各 `page.tsx` の両方**で行う（未ログインは `redirect("/login")`、要件1.7）。APIは別途401を返す。
- `navConfig.ts` の `data` 項目を `href: "/data/me"`, `implemented: true` に変更（要件1.4）。`AppShell` の `activeId="data"` により、3画面のいずれでも「データ」のみがアクティブ（要件1.5）。`AppShell` 側のロジック変更は不要。
- `/data` へのアクセスは `/data/me` へリダイレクトし、ナビの初期表示がマイデータになる（要件1.2）。
- ページ内容は `max-w-4xl mx-auto px-4 py-6 pb-24`（要件1.6、`ui-design-system.md` のモバイル下部余白規定）。

### データ取得方式

初期HTMLにデータを埋め込まず、各リージョン（画面内の独立した表示領域）がRoute Handlerから取得する。理由は、領域ごとのスケルトン（200ms以内）、タイムアウト10秒、領域単位の再試行を要件が求めているため。ページ（Server Component）は認証と、初期選択に必要な最小情報（現在階級など）のみ解決する。

## Components and Interfaces

### フィーチャーディレクトリ

```
src/features/data/
  types/dto.ts                 # APIレスポンスDTO
  utils/
    tier.ts                    # 階級境界・昇格計算
    winRate.ts                 # 勝率計算/フォーマット
    season.ts                  # 月→季節
    aggregate.ts               # 条件別勝率の区分集計
    history.ts                 # 履歴ソート/グラフ点列/差分表記
    participation.ts           # 絞り込み・並べ替え・結果ラベル
    pagination.ts              # offset/limit スライス
    ranking.ts                 # 階級内順位・競技順位
    opponent.ts                # 対戦相手表示名/匿名化
  server/
    authGuard.ts               # requireSession, assertSelf
    dataRepository.ts          # SQL
    handlers.ts                # ルートハンドラ共通ラッパ(エラー変換)
  hooks/useRemoteResource.ts
  components/
    DataTabs.tsx
    RegionState.tsx            # Skeleton / ErrorPanel / Empty
    me/ LevelCard, GranHistory, GranChart, RecordSummary, RecentMatches, WinRateByCondition
    participations/ ParticipationView, ParticipationFilters, ParticipationTable, ParticipationDetail
    ranking/ RankingView, RankingTable
```

### 純粋関数インターフェース（`utils/`）

```ts
// tier.ts
export const TIER_ORDER: readonly TournamentTier[]; // ["DE","D","CD","C","BC","B","AB","A"]（下位→上位）
export function tierLowerBound(tier: TournamentTier): number;   // DE=100 ... A=850
export function tierUpperBound(tier: TournamentTier): number;   // 次階級下限-1、A=999
export function nextTier(tier: TournamentTier): TournamentTier | null; // Aはnull
export interface PromotionInfo {
  tier: TournamentTier;
  next: { tier: TournamentTier; threshold: number; pointsToGo: number; progressPercent: number } | null;
}
export function computePromotion(granLevel: number): PromotionInfo; // tierは granLevelToTier を利用

// winRate.ts
export function winRatePercent1(wins: number, total: number): number | null; // 小数第1位、total=0 → null
export function winRatePercentInt(wins: number, total: number): number | null; // 整数、total=0 → null
export function formatRate1(r: number | null): string; // "66.7%" / "-"

// season.ts
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export function seasonOf(month: number): Season;       // 1..12
export function seasonOfDate(eventDate: string): Season; // "YYYY-MM-DD"

// aggregate.ts
export type Dimension = "category" | "venue" | "surface" | "season" | "opponent" | "series";
export interface DecidedMatch {            // 勝者が確定した FINISHED 試合（ユーザー視点）
  matchId: string; isWin: boolean;
  tournamentCategory: TournamentCategory; genderDivision: GenderDivision | null;
  venue: string; surface: Surface | null; seriesName: string | null;
  eventDate: string; opponentTeamName: string | null; // 団体戦のみ非null
}
export interface Bucket { key: string; label: string; matches: number; wins: number; losses: number }
export function aggregateByDimension(matches: DecidedMatch[], dim: Dimension): Bucket[];
// 固定区分（category: 男子/女子/混合、season: 春夏秋冬）は試合0件でも全区分を返す。
// 動的区分（venue/surface/series/opponent）は試合のある値のみ。surface/series/category の欠損は "未設定" 区分。
// opponent は団体戦（opponentTeamName != null）のみ対象。

// history.ts
export function sortHistoryDesc<T extends { recordedAt: string; seq: number }>(rows: T[]): T[]; // 日時降順、同一日時は seq 降順
export function toChartSeries<T extends { recordedAt: string; seq: number }>(rows: T[]): T[];   // 昇順、全件
export function formatDelta(diff: number): { text: string; direction: "up" | "down" | "flat" }; // "+8" / "−6" / "±0"

// participation.ts
export interface ParticipationFilter { division?: GenderDivision | "UNSET"; tier?: TournamentTier; year?: number }
export function filterParticipations<T extends ParticipationRowBase>(rows: T[], f: ParticipationFilter): T[];
export function sortParticipations<T extends { eventDate: string }>(rows: T[], order: "asc" | "desc"): T[];
export function resultLabel(rank: ResultRank | null): string; // null → "未確定"

// pagination.ts
export function slicePage<T>(rows: T[], offset: number, limit: number): { items: T[]; total: number; nextOffset: number | null };

// ranking.ts
export interface RankCandidate { userId: string; granLevel: number; ratedMatchCount: number;
  recentWins: number; recentTotal: number; isLevelCalibrated: boolean }
export function rankWithinTier(cs: RankCandidate[], tier: TournamentTier): Array<RankCandidate & { rank: number }>;
// 未査定を除外 → 階級範囲に絞る → (gran_level 降順, rated_match_count 降順, 直近勝率 降順, userId 昇順) で整列 → 1..N 連番
export function rankByCompetition<T extends { granLevel: number }>(rows: T[]): Array<T & { rank: number }>;
// 競技順位（1,2,2,4）。rank = 1 + (自分より granLevel が厳密に高い人数)
export function selectCategoryPool(users: Array<{ gender: Gender | null; ... }>, c: RankingCategory): ...;
// MEN→MALE、WOMEN→FEMALE、MIXED→全員

// opponent.ts
export function opponentLabel(args: { isTeamMatch: boolean; teamName: string | null;
  members: Array<{ memberType: "REGISTERED" | "GUEST" | "PENDING"; nickname: string | null }> }): string;
// ゲスト→"ゲスト"、PENDING→"未定"、団体戦は teamName 優先、個人/ペアは nickname を「・」連結
```

直近勝率の比較は浮動小数の誤差を避けるため `wins1 * total2` と `wins2 * total1` の整数比較で行う（`recentTotal = 0` は最下位扱い）。「直近」は、当該ユーザーの勝者確定済み試合の新しい順10件とする（要件8.5の「直近」を10試合と定義）。

### Route Handler仕様

すべて `GET`、`Cache-Control: no-store`。認証は `requireSession()`。クエリに `userId` が付与され、かつセッションの `sub` と異なる場合は403（要件11.2）。`userId` が無い場合は常にセッションのユーザーを対象とする。

| パス | クエリ | 200レスポンス |
| --- | --- | --- |
| `/api/data/me/level` | - | `LevelDto` |
| `/api/data/me/gran-history` | `offset`(既定0), `limit`(既定20, 最大50) | `{ rows: HistoryRowDto[]; total; nextOffset; chart?: ChartPointDto[] }`（`chart` は `offset=0` のときのみ全件・古い順） |
| `/api/data/me/record` | - | `{ total; wins; losses; recent: RecentMatchDto[] }` |
| `/api/data/me/win-rate` | `dimension` | `{ dimension; buckets: Bucket[]; totalMatches }` |
| `/api/data/participations` | `division`,`tier`,`year`,`order`(`asc`/`desc`、既定desc),`offset`,`limit`(既定20) | `{ rows: ParticipationRowDto[]; total; nextOffset; years: number[] }` |
| `/api/data/participations/[tournamentId]` | - | `ParticipationDetailDto`（本人が当該大会に出場していない場合は404） |
| `/api/data/ranking/tier` | `tier`, `offset`(既定0), `limit`(既定50) | `{ tier; rows: RankingRowDto[]; total; nextOffset; me: { rank; total } \| null }` |
| `/api/data/ranking/category` | `category`(`MEN`/`WOMEN`/`MIXED`), `offset`, `limit` | `{ category; rows: RankingRowDto[]; total; nextOffset; me: { rank; total } \| null }` |

エラー形式（共通）: `{ "error": { "code": "UNAUTHENTICATED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL", "message": string } }`。ステータスは 401 / 403 / 400 / 404 / 500。入力検証はzod（`dimension`, `tier`, `category`, `order` は列挙、`offset`/`limit` は整数範囲）。

### 認証ガード（`authGuard.ts`）

```ts
export async function requireSession(): Promise<{ userId: string } | Response>; // 未ログインは 401 Response
export function assertSelf(sessionUserId: string, requested: string | null): Response | null; // 異なれば 403
```

### クライアントフック（`useRemoteResource`）

```ts
interface Options<T> { url: string | null; timeoutMs?: number /* 10000 */; keepStaleOnError?: boolean }
interface State<T> {
  status: "loading" | "success" | "error";
  data: T | null;            // keepStaleOnError=true のとき error 中も直前の成功データを保持
  consecutiveFailures: number; // 成功で0にリセット
  retry(): void;
}
```

- `url` 変更または `retry()` で再取得。`status` は即座に `loading` になり、スケルトンが同一レンダー内で描画される（要件10.1の200ms以内を満たす）。
- `AbortController` で10秒タイムアウト。通信エラー・非2xx・タイムアウトはすべて `error`。
- `consecutiveFailures >= 3` のとき、`ErrorPanel` は再試行ボタンを維持したまま「時間をおいて再度お試しください」を追加表示（要件10.4）。
- `keepStaleOnError`: 要件が「保持」を求める領域（履歴追加読み込み、条件別勝率、ランキング、出場詳細を開いた一覧）は `true`。要件が「表示しない」を求める領域（GRANレベル、通算勝敗）は `false`。

### 主要UIコンポーネント

- `DataTabs`（Client）: 「マイデータ / 出場データ / ランキング」を左から1行で常時表示。`usePathname()` で選択中を判定し、`aria-current="page"` と下線+背景色で強調（要件1.1, 1.3）。`Link` による遷移。
- `RegionState`: `<Skeleton/>`・`<ErrorPanel onRetry/>`・`<EmptyState/>` を提供。エラー時も周囲のタブ/ナビは維持（要件1.8）。
- `LevelCard`: GRANレベル、階級（`is_level_calibrated=false` は「査定前」表示）、昇格差、進捗バー（`role="progressbar"` + 数値テキスト）。
- `GranHistory` / `GranChart`: 一覧20件+「もっと見る」。`GranChart` は自前SVG折れ線。各点は `tabindex=0` / `role="button"` でフォーカス・選択でき（44px以上の当たり判定の透明円）、選択点の日付・大会名・変動後レベルをテキスト表示。要件10.7のため、全点の値を `<details>` 内の表に出力する。
- `RecordSummary` / `RecentMatches`: 勝敗は「勝」「敗」の文字+色の両方（要件4.4）。Participation_Pageへのリンク。
- `WinRateByCondition`: 6条件のタブ（`role="tablist"`）、区分ごとに「試合数/勝/敗/勝率(整数%)」の行と、勝率に比例した幅の横棒（0試合は「-」・幅0）。
- `ParticipationTable`: md以上は表、md未満は「開催年月日・会場・結果」の3項目のカード行で横スクロールなし（要件6.6）。行は `role="button"` `tabIndex=0`、Enter/Spaceで選択、`min-h-[44px]`（要件7.6）。
- `ParticipationDetail`: `role="dialog"` `aria-modal`。開くとき `history.pushState({ detail: tournamentId }, "")`、`popstate`・Esc・閉じるボタンで閉じ、直前に押下した行へ `focus()` を戻す。一覧コンポーネントはマウントしたまま背面に残すため、スクロール位置と絞り込み状態が保持される（要件7.5, 7.7）。
- `RankingView`: 上部1か所に「階級別 / 種目別」切替。階級タブ（要件8.1どおり**A, AB, B, BC, C, CD, D, DE の順**）と種目タブ（男子/女子/混合）。選択状態は親の `useState`（`{ mode, tier, category }`）に保持し、モード切替で破棄しない（要件9.6）。初期の階級は `granLevelToTier(currentUser.granLevel)`、初期の種目は男子。

### 画面表示の共通規約

- 本文 `text-sm`(14px)以上、注釈 `text-xs`(12px)。それ未満のクラスは使わない（要件10.5）。
- 勝敗・増減は「+8 ▲」「−6 ▼」「±0」「勝」「敗」のように記号/文字/アイコンを併用（要件10.6）。
- カラートークンは `ui-design-system.md` に従い、`bg-white dark:bg-slate-900`、`text-slate-900 dark:text-slate-100`、`border-slate-200 dark:border-slate-800`、Primaryは `emerald-600 / dark:emerald-500` を使用。角丸はカード `rounded-2xl`、リスト/ボタン `rounded-xl`。ダーク時の本文・注釈コントラスト4.5:1以上を満たす組み合わせ（`slate-100/slate-300 on slate-900`）に限定し、注釈に `slate-500` 以下の薄い色は使わない（要件10.8, 10.9）。

## Data Models

### スキーマ変更（`src/lib/db.ts`）

既存DBには `CREATE TABLE IF NOT EXISTS` ではカラムが追加されないため、`ensureColumn(table, column, ddl)`（`PRAGMA table_info` で存在確認後 `ALTER TABLE ADD COLUMN`）を `createDatabase()` に追加し、冪等に適用する。

```sql
-- 大会シリーズ
CREATE TABLE IF NOT EXISTS tournament_series (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- tournaments への列追加（すべてNULL許容）
ALTER TABLE tournaments ADD COLUMN surface TEXT
  CHECK (surface IN ('HARD','CLAY','ARTIFICIAL_GRASS','OTHER'));
ALTER TABLE tournaments ADD COLUMN series_id TEXT REFERENCES tournament_series(id);
ALTER TABLE tournaments ADD COLUMN gender_division TEXT
  CHECK (gender_division IN ('MEN','WOMEN','MIXED'));

-- 試合（db-schema.md 3.9 準拠 + 登録日時）
CREATE TABLE IF NOT EXISTS tournament_matches (
  id              TEXT PRIMARY KEY,
  tournament_id   TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL,
  match_number    INTEGER NOT NULL,
  court_name      TEXT,
  entry1_id       TEXT REFERENCES entries(id),
  entry2_id       TEXT REFERENCES entries(id),
  winner_entry_id TEXT REFERENCES entries(id),
  score_detail    TEXT,
  match_status    TEXT NOT NULL DEFAULT 'READY'
                    CHECK (match_status IN ('READY','PLAYING','FINISHED')),
  next_match_id   TEXT REFERENCES tournament_matches(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
);

-- 大会結果・GRANレベル変動（db-schema.md 3.10 準拠、ユーザー単位）
CREATE TABLE IF NOT EXISTS tournament_results (
  id              TEXT PRIMARY KEY,
  tournament_id   TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id         TEXT REFERENCES teams(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  rank_type       TEXT NOT NULL
                    CHECK (rank_type IN ('PARTICIPATED','L2_WINNER','T1_RUNNER_UP','T1_WINNER')),
  awarded_points  INTEGER,
  pre_gran_level  INTEGER NOT NULL,
  gran_level_diff INTEGER NOT NULL,
  post_gran_level INTEGER NOT NULL,
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  UNIQUE (tournament_id, user_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_entry_members_user ON entry_members(user_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_results_user_recorded ON tournament_results(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_entry1 ON tournament_matches(entry1_id);
CREATE INDEX IF NOT EXISTS idx_matches_entry2 ON tournament_matches(entry2_id);
```

`UNIQUE (tournament_id, user_id)` は、出場詳細で1大会に結果が複数紐づく曖昧さを避けるため追加する（`docs/db-schema.md` への追記が必要）。`docs/db-schema.md` には上記の追加カラム/テーブルを反映する（実装タスクに含める）。

### ユーザー視点の試合ビュー（SQL）

```sql
-- :uid = ログインユーザー。ブロックされたエントリー(CANCELLED/WAITING)は含めない。
SELECT m.id AS match_id, m.tournament_id, m.round_number, m.score_detail,
       m.winner_entry_id, m.match_status, m.created_at, m.rowid AS seq,
       self.entry_id AS my_entry_id,
       CASE WHEN m.entry1_id = self.entry_id THEN m.entry2_id ELSE m.entry1_id END AS opp_entry_id
  FROM entry_members self
  JOIN entries e ON e.id = self.entry_id AND e.status IN ('CONFIRMED','ATTENDED')
  JOIN tournament_matches m ON self.entry_id IN (m.entry1_id, m.entry2_id)
 WHERE self.user_id = :uid AND self.member_type = 'REGISTERED'
   AND m.entry1_id IS NOT NULL AND m.entry2_id IS NOT NULL;  -- 不戦(BYE)は除外
```

- 勝敗: `winner_entry_id = my_entry_id` → 勝、`winner_entry_id IS NOT NULL` かつ異なる → 敗、`FINISHED` で `winner_entry_id IS NULL` → 引き分け（詳細のみ）。
- 統計対象: `match_status='FINISHED' AND winner_entry_id IS NOT NULL`。
- 試合日は `tournaments.event_date`。直近試合の並び順: `event_date DESC, m.created_at DESC, m.rowid DESC`（要件4.2）。

### 出場履歴のSQL条件

対象エントリー: `entries.status IN ('CONFIRMED','ATTENDED')`（`CANCELLED` と `WAITING` は除外、要件6.9）かつ `tournaments.event_date <= date('now','+9 hours')`（開催日を迎えたもの）。ユーザーの所属は `entry_members.user_id`（`REGISTERED`）で判定。結果は `tournament_results (tournament_id, user_id)` を `LEFT JOIN`（無ければ「未確定」）。

### GRANレベル履歴のSQL

`tournament_results` を `user_id` で絞り、`ORDER BY recorded_at DESC, rowid DESC`。大会名は `tournaments.title` をJOIN。ページングは `LIMIT/OFFSET`（同一日時の並び順が `rowid` で一意なので連結時に重複・欠落しない）。グラフ用は同条件を `ASC` で全件取得。

### ランキングのSQL

- 階級別: `users` から `is_level_calibrated = 1 AND status = 'ACTIVE' AND gran_level BETWEEN :lo AND :hi` を取得。直近勝率用に、候補ユーザーの勝者確定済み試合を新しい順に10件ずつ取得（`ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_date DESC, created_at DESC) <= 10`）。整列・順位付けはTS側の `rankWithinTier` で行い、`slicePage` で50件単位に切る。階級あたりの母数は数百〜千人規模を想定し、メモリ整列で十分と判断した。
- 種目別: 同じ `users` 条件に `gender` 条件（`MEN→MALE`, `WOMEN→FEMALE`, `MIXED→条件なし`）を足し、`gran_level DESC` で取得して `rankByCompetition`。
- `me`（自分の順位/総人数）は、自分が整列結果に含まれる場合のみ返す。ページ外にいても返すため、UIは「3位 / 42人」を常に表示でき、自分の行は表示ページ内にある場合に強調する。
- 既存の `idx_users_gran_level` を利用。性別条件の追加インデックスは負荷計測後に判断する。

### DTO（`types/dto.ts`）

```ts
export interface LevelDto {
  granLevel: number; isCalibrated: boolean; tier: TournamentTier;
  next: { tier: TournamentTier; threshold: number; pointsToGo: number; progressPercent: number } | null;
}
export interface HistoryRowDto { id: string; recordedAt: string; tournamentTitle: string;
  preLevel: number; diff: number; postLevel: number }
export interface ChartPointDto { recordedAt: string; tournamentTitle: string; postLevel: number }
export interface RecentMatchDto { matchId: string; eventDate: string; tournamentTitle: string;
  opponent: string; result: "WIN" | "LOSS"; score: string | null }
export interface ParticipationRowDto { tournamentId: string; title: string; eventDate: string; venue: string;
  category: TournamentCategory; genderDivision: GenderDivision | null; tier: TournamentTier;
  result: ResultRank | null }
export interface ParticipationDetailDto extends ParticipationRowDto {
  matches: Array<{ round: number; opponent: string; score: string | null;
                   outcome: "WIN" | "LOSS" | "DRAW" | "UNDECIDED" }>;
  granChange: { pre: number; diff: number; post: number } | null; // null = 未確定
  isResultConfirmed: boolean;
}
// ランキングに載せる他ユーザー情報はこの4項目のみ（要件8.8, 11.4）
export interface RankingRowDto { rank: number; userId: string; nickname: string;
  avatarUrl: string | null; granLevel: number; tier: TournamentTier; isMe: boolean }
```

`RankingRowDto` に氏名・メール・電話・成績詳細は**型レベルで存在しない**。リポジトリのSELECTも `nickname, avatar_url, gran_level, id` のみに限定する。種目別では `tier` を表示、階級別でも同じDTOを用いる（階級別は全員同一階級）。`userId` は自分判定（`isMe`）のためサーバー側で算出し、クライアントには比較済みの `isMe` を返す（IDそのものを公開項目に数えないため、本番では `userId` を除去し `isMe` のみを返す。上記DTOの `userId` はサーバー内部の整列用フィールドとする）。

### 結果区分ラベル

`PARTICIPATED→参加`, `L2_WINNER→2位トーナメント優勝`, `T1_RUNNER_UP→1位トーナメント準優勝`, `T1_WINNER→1位トーナメント優勝`, `null→未確定`。

### 対戦相手表示（要件11.5, 11.6）

団体戦（`MEN_TEAM`/`WOMEN_TEAM`/`MIX_TEAM`）は対戦チーム名（`teams.name`、未設定なら下記個人表示にフォールバック）。シングルス/ダブルスは相手エントリーの `entry_members` から、`REGISTERED` はニックネーム、`GUEST` は固定文言「ゲスト」（`guest_name` は読み出さない）、`PENDING` は「未定」を「・」で連結。`real_name` は対戦相手関連のSELECTに含めない。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

プロパティ・リフレクションの結果: 「履歴の降順」「出場履歴のページング」「ランキングの50件ページング」は同一の `slicePage` 性質に統合した。「3.5の符号表記」と「7.4の変動表記」は `formatDelta` に統合した。「勝率の算出」「勝率の整数表示/0試合」は `winRate` の性質に統合した。階級別と種目別のレベル一致は、ランキングDTOの生成元が同一であることとして1つにまとめた。

### Property 1: 階級判定と昇格情報の整合

*For any* GRANレベル（100〜999の整数）に対し、`computePromotion` は (a) 8階級のうちちょうど1つの階級を返し、階級の範囲 `[tierLowerBound, tierUpperBound]` に当該レベルが含まれる、(b) 最上位階級（A）以外では、次階級の下限値が閾値となり `pointsToGo = 閾値 − レベル` は1以上、`progressPercent` は0〜100に収まる、(c) 最上位階級では `next` が `null` になる。

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

### Property 2: 勝率の算出と表示

*For any* 非負整数 `wins ≤ total` に対し、`total = 0` なら勝率は `null`（表示「-」、棒の長さ0）、`total > 0` なら `winRatePercent1` は 0.0〜100.0 で小数第1位までの値、`winRatePercentInt` は 0〜100 の整数であり、`winRatePercentInt` は `winRatePercent1` を整数に四捨五入した値と一致する。

**Validates: Requirements 4.1, 5.6, 5.7**

### Property 3: 条件別集計は試合を丁度1区分に分類する

*For any* 勝者確定済み試合の集合と任意の `Dimension` に対し、`aggregateByDimension` が返す区分について、(a) 各区分で `wins + losses = matches`、(b) 区分の `matches` の合計は対象試合数（`opponent` は団体戦のみ）と等しい、(c) `surface`/`series` が未登録（および `category` で部門が判定できない）試合は「未設定」区分に入る、(d) `category` は男子・女子・混合の3区分、`season` は春夏秋冬の4区分を常に返す。入力に `FINISHED` でない試合や個人戦（`opponent` 次元）は含まれない（呼び出し側のフィルタ後を前提に、集計関数は入力を過不足なく数える）。

**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.8, 5.9**

### Property 4: 季節は月の全域写像

*For any* 月（1〜12）に対し、`seasonOf` はちょうど1つの季節を返し、3〜5月は春、6〜8月は夏、9〜11月は秋、12・1・2月は冬である。

**Validates: Requirements 5.4**

### Property 5: ページングは全件を過不足なく分割する

*For any* 配列と正の `limit` に対し、`offset = 0, limit, 2·limit, …` で `slicePage` を連結した結果は元の配列と一致し（重複・欠落なし）、各ページの件数は `limit` 以下、最後のページ以外では `nextOffset` が非nullである。

**Validates: Requirements 3.8, 6.3, 8.10**

### Property 6: 履歴は新しい順、グラフは全件を古い順

*For any* GRANレベル履歴の集合に対し、`sortHistoryDesc` の結果は `recordedAt` の降順で、同一 `recordedAt` では `seq` の降順であり、`toChartSeries` の結果は同じ要素を過不足なく含み `recordedAt`（同値は `seq`）の昇順である。

**Validates: Requirements 3.1, 3.3, 3.4**

### Property 7: 変動値の表記

*For any* 整数の変動値 `diff` に対し、`formatDelta` は `diff > 0` なら「+」で始まり方向 `up`、`diff < 0` なら「−」で始まり方向 `down`、`diff = 0` なら「±0」で方向 `flat` を返し、数値部分の絶対値は `|diff|` と一致する。

**Validates: Requirements 3.5, 7.4**

### Property 8: 直近試合は最大5件で新しい順

*For any* 試合の集合に対し、直近試合の選択結果は最大5件で、`eventDate` の降順（同日は登録の新しい順）であり、選択されなかった試合のいずれも、選択された最後の試合より新しくない。

**Validates: Requirements 4.2**

### Property 9: 出場履歴の絞り込みと並べ替え

*For any* 出場履歴と任意の絞り込み条件（種目・階級・年の任意の組み合わせ）に対し、`filterParticipations` の結果は指定された全条件を満たす行のみで構成され、条件を満たす行をすべて含む。さらに `sortParticipations` の結果は指定方向（昇順/降順）に `eventDate` が整列され、元の行の多重集合は変わらない。

**Validates: Requirements 6.1, 6.4, 6.5**

### Property 10: キャンセル済み・キャンセル待ちは出場履歴に現れない

*For any* 任意のエントリー状態（`CONFIRMED`/`WAITING`/`CANCELLED`/`ATTENDED`）の組み合わせを持つユーザーに対し、出場履歴・総件数・絞り込み結果に含まれるエントリーは `CONFIRMED` または `ATTENDED` かつ開催日を迎えたものに限られる。

**Validates: Requirements 6.9**

### Property 11: 出場詳細の試合はラウンド昇順

*For any* 大会内の試合集合に対し、出場詳細の試合一覧は `round_number` の昇順で並ぶ。

**Validates: Requirements 7.3**

### Property 12: 階級内順位の整列とタイブレーク

*For any* ユーザー集合と任意の階級に対し、`rankWithinTier` の結果は (a) 査定済みで当該階級の範囲に入るユーザーのみ、(b) `granLevel` の降順、同値では `ratedMatchCount` の降順、さらに同値では直近勝率の降順に整列、(c) 順位は1からNまでの重複のない連番、(d) 総人数は(a)の人数と等しく、自分の順位は1以上総人数以下である。

**Validates: Requirements 8.3, 8.5, 8.6, 8.9**

### Property 13: 種目別順位は競技順位（同値は同一順位）

*For any* GRANレベルの集合に対し、`rankByCompetition` が付与する順位は「自分より厳密に高いレベルの人数 + 1」と等しく、同一レベルは同一順位、レベルが高いほど順位の数値は小さいか等しい。

**Validates: Requirements 9.2, 9.4**

### Property 14: 種目別の集計単位と階級別との一致

*For any* ユーザー集合に対し、種目別の母集団は 男子=性別MALE、女子=性別FEMALE、混合=全員（査定済み・ACTIVEのみ）であり、あるユーザーが階級別と種目別の両方に現れる場合、両方で表示される `granLevel` は同一の `users.gran_level` の値である。

**Validates: Requirements 9.7, 9.8**

### Property 15: 他ユーザー公開情報の限定

*For any* ユーザー（任意の実名・メール・電話番号・成績を持つ）に対し、ランキングDTOに変換した結果が持つキーは `rank`, `nickname`, `avatarUrl`, `granLevel`, `tier`, `isMe`（サーバー内部の整列用IDを除く）のみであり、実名・メール・電話番号の値を文字列として含まない。

**Validates: Requirements 8.8, 11.4**

### Property 16: 対戦相手の匿名化

*For any* 対戦相手のメンバー構成（`REGISTERED`/`GUEST`/`PENDING` の任意の組み合わせ、任意のゲスト氏名）に対し、`opponentLabel` が返す文字列は、`GUEST` メンバーについては固定文言「ゲスト」を用い、ゲスト氏名を含まない。`REGISTERED` メンバーはニックネームで表示される。

**Validates: Requirements 11.5, 11.6**

## Error Handling

| 事象 | サーバー | クライアント表示 |
| --- | --- | --- |
| 未ログイン（ページ） | `redirect("/login")` | コンテンツを描画しない（要件1.7） |
| 未ログイン（API） | 401 `UNAUTHENTICATED` | 領域に認証が必要な旨のエラー。データなし（要件11.3） |
| 他ユーザーのデータ要求 | 403 `FORBIDDEN`、本文にデータを含めない | アクセス権限なしのエラー（要件11.2） |
| 不正なクエリ | 400 `BAD_REQUEST`（zod） | 汎用の取得失敗として扱う |
| 未出場大会の詳細要求 | 404 `NOT_FOUND` | 詳細ダイアログ内に取得失敗+再試行 |
| DB例外 | 500 `INTERNAL`、詳細はログのみ（内部情報を返さない） | 取得失敗+再試行 |
| 通信失敗/10秒無応答 | - | `ErrorPanel`（失敗メッセージ+再試行）。周囲のタブ/ナビ/他領域は維持（要件1.8, 10.2） |
| 再試行 | - | 失敗領域のみ再取得しスケルトン表示（要件10.3）。連続3回失敗で追加メッセージ（要件10.4） |

領域別の失敗時挙動:

- マイデータ GRANレベル/通算勝敗: 数値を非表示にしてエラーのみ（要件2.7, 4.8）。
- GRANレベル履歴の追加読み込み失敗: 表示済み行を保持し、「もっと見る」を再度押せる状態で、追加失敗メッセージを表示（要件3.9, 3.10）。
- 条件別勝率: 直前の集計結果を保持（要件5.11）。
- 出場履歴: 失敗時に空の表を出さずエラーを出す（要件6.10）。出場詳細の失敗は一覧の状態を保持（要件7.7）。
- ランキング: 選択中タブを保持し、直前の順位表を保持（要件8.11, 9.10）。

空状態: 履歴0件（要件3.7）、試合0件（4.6）、集計対象0件（5.10）、出場履歴0件（6.7、大会日程 `/tournaments` へのリンク付き）、絞り込み0件（6.8、条件解除ボタン付き）、階級/種目の該当者0人（8.7, 9.9）。

データ不整合への防御: `gran_level` が100〜999外、未知の `rank_type`、`entry2_id` NULL（不戦）の試合は、画面を落とさず集計から除外する（SQL条件とTSの型ガードで処理）。

## Testing Strategy

本機能は純粋なロジック（階級計算、集計、順位付け、ページング、匿名化）を多く含むため、**プロパティベーステストを採用**する。UI描画、ルーティング、スキーマ追加はPBTの対象外で、例示テストとスモークテストで検証する。

### ツールとセットアップ

現状 `package.json` にテスト基盤が無い。devDependenciesに `vitest` と `fast-check` を**バージョン固定**で追加し、`"test": "vitest --run"` を追加する（実行は単発。ウォッチ不使用）。UI部品のテストが必要な場合のみ `@testing-library/react` と `jsdom` を追加する。パスエイリアス `@/` は `vitest.config.ts` で `tsconfig` と合わせる。

### プロパティテスト

- 対象は Property 1〜16。各プロパティを**単一のプロパティテスト**で実装し、`fc.assert(..., { numRuns: 100 })` 以上（最小100回）で実行する。
- 各テストにタグコメントを付ける。形式: `// Feature: data-tab-restructure, Property {番号}: {プロパティ名}`。
- Property 10 はインメモリ `new DatabaseSync(":memory:")` に必要テーブルを作成し、`createDataRepository(db)` に注入して実行する（`NOW_JST` 依存の日付は固定の過去日で生成）。反復1回あたりが軽いため100回実行する。
- Property 15, 16 は DTO 変換関数/`opponentLabel` に対して、任意文字列の氏名・メールなどを生成して検査する。
- ジェネレータは、境界値（レベル100/999/各階級境界、勝敗0件、同値レベル、同日試合）を含むよう `fc.constantFrom` と `fc.integer` を併用する。

### 例示テスト・単体テスト

- ルートハンドラ: 未ログイン→401、`userId` 不一致→403、自分のデータのみ返却（要件11.1〜11.3）。`next/headers` の `cookies` をモックして実行。
- 出場詳細: 未確定時の表示、GRAN変動の表示、未出場大会の404。
- `useRemoteResource`: フェイクタイマーで10秒タイムアウト、3回連続失敗、`keepStaleOnError` の有無（要件2.9, 10.2〜10.4）。
- コンポーネント: タブの順序と `aria-current`、勝敗の文字+色併用、行のキーボード操作（Enter/Space）、ダイアログのEsc/戻る/フォーカス復帰、ランキングのモード切替後の選択状態の復元（要件1.1, 4.4, 7.5, 7.6, 9.6）。
- スケルトン表示が取得開始の同一レンダーで出ること（200ms以内の保証は実装構造で担保）。

### スモーク・統合

- `navConfig` の `data` 項目が `implemented: true` かつ `href: "/data/me"`（要件1.4）。
- 各ページが `max-w-4xl` を含む（要件1.6）。
- `createDatabase()` を既存DBファイル相当のスキーマに対して2回実行しても、`ensureColumn` が冪等であること。
- 手動確認（自動化しない）: ダーク時のコントラスト4.5:1、320px幅でのレイアウト崩れ、スクリーンリーダー読み上げ。WCAG準拠の完全な検証には、支援技術を使った手動テストと専門家レビューが必要である。

### 開発用データ

`scripts/seed.ts` に、試合・結果・シリーズ・サーフェス・性別区分を含むサンプルデータ投入を追加し、全画面の手動確認に使えるようにする（ゲスト、不戦、未確定結果、引き分け、同値レベルのケースを含める）。
