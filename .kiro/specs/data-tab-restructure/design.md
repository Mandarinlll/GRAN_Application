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
4. 新規依存はテスト用（vitest, fast-check）のみ。グラフは自前SVGで描画する（依存追加なし）。軸目盛りの計算（`niceTicks` / `dateTicks`）とスライダー値の変換は、描画から切り離した純粋関数にする。

### 未確定事項の確定（要件書「前提と未確定事項」への回答）

| 項目 | 決定 | 根拠 |
| --- | --- | --- |
| サーフェス | `tournaments.surface` 追加（`HARD` / `CLAY` / `ARTIFICIAL_GRASS` / `OTHER`）。**今後の大会登録・更新ではアプリ層（zod）で必須**。DB列はNULL許容のまま。既存のNULLデータは**サーフェス別集計から除外**（「未設定」区分は作らない） | 要件5.8, 5.15, 5.16。SQLiteは既存列へNOT NULLを後付けできないため `gender_division` と同方式 |
| 大会シリーズ | 新テーブル `tournament_series(id, name)` と `tournaments.series_id`（NULL可・FK）。NULL（未登録）は専用キー `UNREGISTERED_SERIES_KEY` の**「その他」区分**（`Unregistered_Series_Group`）に集計し、一覧の末尾に置く。登録済みシリーズに「その他」という名称があっても別区分で合算しない | 要件5.14, 5.15。名称変更を1箇所で反映できる正規化。区分キーを名称と分離して衝突を防ぐ |
| 季節 | `event_date` の月から導出。春3–5/夏6–8/秋9–11/冬12–2。DBカラムは持たない | 要件の用語集どおり。純粋関数 `seasonOf(month)` |
| 昇格ポイント境界 | `granLevelToTier` の下限値を採用。Promotion_Threshold = 次階級の下限値（DE→D: 250, D→CD: 350, CD→C: 450, C→BC: 550, BC→B: 650, B→AB: 750, AB→A: 850。Aは最上位で閾値なし）。差 = 閾値 − 現在値（常に1以上）。進捗 = (現在値 − 現階級下限) ÷ (閾値 − 現階級下限) を0–100%に丸め | docsの査定レンジは重複しているが（例: A 850–999 / AB 750–870）、それは**初期査定の目安**。実判定は既存実装の連続境界で行われており、表示と一貫させる |
| 種目別ランキングの集計単位 | **性別による区分**。順位の元は常に `users.gran_level` の1値。男子=`gender='MALE'`、女子=`gender='FEMALE'`、混合=全ユーザー（性別未設定・OTHER含む） | 種目別レーティングはDBに存在せず、要件9.7（階級別と同じ値）を満たす最小構成。種目別Eloは将来拡張 |
| 団体戦の個人別勝敗粒度 | **試合（`tournament_matches` 1行＝エントリー対エントリー）単位**で集計。ユーザーは `entry_members`（`REGISTERED`）に含まれるエントリーの勝敗を自分の勝敗とする。個人ペア単位の子テーブル（`tournament_match_games`）は将来拡張とし、本機能では作らない | 管理者要件で粒度が未決。要件5.5が「団体戦の対戦チーム単位」であり、チーム単位で要件を全て満たせる |
| 引き分け | 勝者未設定の `FINISHED` 試合は勝敗集計から除外（詳細表示のみ「引き分け」と表示）。集計対象を「勝者が確定した FINISHED 試合」に限り、要件4.1の `勝利+敗北=試合数` を保証 | テニスに引き分けは通常無く、データ不備を統計に混ぜない |
| 「種目」の定義（統計/絞り込み） | 大会の `category` から `MEN_TEAM→男子`, `WOMEN_TEAM→女子`, `MIX_TEAM→混合`。`SINGLES`/`DOUBLES` は性別が分からないため `tournaments.gender_division`（`MEN`/`WOMEN`/`MIXED`）を追加して参照する。**種目に「未設定」は存在させない**（下記「種目を必須とする方針」） | `category` だけでは単・複の男女が判別できないため。種目は設計上、常に男子/女子/混合のいずれかである（要件5.3, 5.8） |

#### 種目を必須とする方針（「未設定」区分の解消）

- 団体戦（`MEN_TEAM`/`WOMEN_TEAM`/`MIX_TEAM`）の種目は `category` から一意に決まる。`gender_division` が NULL でも `category` から導出する。
- `SINGLES`/`DOUBLES` の大会は `gender_division` を**必須入力**とする。大会の登録・更新経路（zod スキーマ）で、`SINGLES`/`DOUBLES` かつ `gender_division` 未指定を 400 で拒否する。`seed.ts` も必ず設定する。
- `ensureColumn` で列を追加する際、既存行には `category` が団体戦の行のみ `gender_division` を一括補完する（`UPDATE ... SET gender_division = CASE category WHEN 'MEN_TEAM' THEN 'MEN' ...`、冪等）。SQLite は `ALTER TABLE ADD COLUMN` で NOT NULL を後付けできないため、列定義は NULL 許容のまま残し、必須性はアプリ層で担保する。
- 既存データに残る「`SINGLES`/`DOUBLES` かつ `gender_division` が NULL」の行は、種目を判別できない不正データとして**種目の集計から除外**する（「未設定」区分は作らない）。他の条件（会場・サーフェス・季節・対戦相手・シリーズ）の集計と、通算勝敗には引き続き含める。
- 出場履歴の種目絞り込みも、同じ理由で「未設定」選択肢を持たない（男子/女子/混合のみ）。

#### サーフェスを必須とする方針（「未設定」区分の廃止）

要件5.8 / 5.15 / 5.16 に基づき、サーフェスの「未設定」区分は設けない。種目（`gender_division`）と同じ方針で扱う。

- **登録・更新経路（調査結果）**: 大会の登録・更新の検証は `src/features/tournaments/types/schema.ts`（`tournamentCreateSchema` / `validateTournamentUpdate` / `requireGenderDivisionForIndividual`）にあり、現状は `gender_division` のみ検証している。`createTournament`（`src/features/tournaments/server/tournamentRepository.ts`）は `tournamentCreateSchema.parse` を呼ぶが、`CreateTournamentParams` に `surface` / `seriesId` が無く、INSERT も `surface` / `series_id` を書いていない。同ファイルのコメントのとおり本番の**管理者向け大会登録のUI・APIは未実装（別スコープ）**で、呼び出し元は現状ない（`createTournament(` の参照が定義のみ）。
- **本機能で行う変更**: (1) `schema.ts` に `surfaceSchema = z.enum(["HARD","CLAY","ARTIFICIAL_GRASS","OTHER"])` を追加し、`tournamentCreateSchema` で `surface` を**必須**（未指定・`null` は拒否、`path: ["surface"]`）にする。`validateTournamentUpdate` は入力が無ければ既存値（`existing.surface`）で最終検証する（既存値が NULL の旧データを更新する場合は、`surface` を指定しない更新を拒否する。`gender_division` と同じ扱い）。(2) `CreateTournamentParams` に `surface` を必須で追加し、INSERT に `surface` を含める（`seriesId` は任意で追加し、`series_id` を書き込む）。管理者向けの登録画面・APIそのものは別スコープのため、本機能では作らない。将来それらを実装する際は、この zod スキーマを共通で通す。
- **DB**: `surface` 列は NULL 許容のまま（`ensureColumn` の定義は変更しない）。既存 NULL データは補完せず、**サーフェス別集計から除外**する。通算勝敗と他の条件（種目・会場・季節・対戦相手・大会シリーズ）の集計には含める。
- **シード/フィクスチャ**: 「サーフェスが NULL の大会」は、以後は新規登録では作れない**旧データを再現する目的**に限る。
  - `scripts/seed.ts` の `DATA_SEED_TOURNAMENTS` は、現状 `t4`（`surface: null, series: null`）が「未設定」を再現している。`t4` のサーフェスは通常の値（例: `HARD`）に変更し、`series: null` は「その他」区分（`Unregistered_Series_Group`）の確認用に残す。`DataSeedTournament.surface` の型は `Surface | null` から `Surface` に狭める。旧データ（サーフェス NULL）の除外確認は、フィクスチャ側で担保する（シードは「登録できる状態のデータ」のみ作る方針）。通常シードの大会（`scripts/seed.ts` 758行付近の INSERT）は `surface` を書かない（NULL）ため、`surface` を指定して挿入する（ユーザー画面の大会表示用データのため値は任意の登録可能な値でよい）。
  - `src/test/fixtures/dataTabFixture.ts` の `t06`（`surface: null`、コメント「サーフェス未設定」）は**旧データ（サーフェス NULL）として維持**する。生SQLでの挿入のためスキーマ検証を通らず、除外動作の検証に使える。コメントは「旧データ: サーフェス NULL（集計から除外される）」に更新する。`tournament()` ヘルパーの `surface` 型は `Surface | null` のまま（旧データを表現するため）。

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
    chartAxis.ts               # 縦軸 niceTicks / 横軸 dateTicks（純粋関数）
    chartTooltip.ts            # Chart_Tooltip の配置計算 tooltipPosition（純粋関数）
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
    ranking/ RankingView, RankingTable   # 実装は src/components/ranking/ に配置済み。階級選択は TierSlider
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

// Tier_Slider 用（tier.ts）。スライダー値は TIER_ORDER の添字: 0=DE（左端）… 7=A（右端）。
// 値が増える方向が「上位Tier」で、右/上矢印キー＝上位（要件8.12）と一致する。
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 7;
export function tierToSliderValue(tier: TournamentTier): number;      // DE→0 … A→7
export function sliderValueToTier(value: number): TournamentTier;    // 範囲外/非整数は snapSliderValue を通してから変換
export function snapSliderValue(raw: number): number;                // 最寄りの整数に丸め 0..7 にクランプ。NaN は 7(A)
export function stepSliderValue(value: number, delta: 1 | -1): number; // 1段階移動。端を超えない
export function initialSliderTier(current: TournamentTier | null): TournamentTier; // 判定不能(null)は "A"（要件8.14）

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
  tournamentCategory: TournamentCategory;
  genderDivision: GenderDivision | null;   // 団体戦は category から導出。SINGLES/DOUBLES で null は不正データ（種目集計から除外）
  venue: string; surface: Surface | null; seriesName: string | null; // surface=null は旧データ（サーフェス別集計から除外）
  eventDate: string; opponentTeamName: string | null; // 団体戦のみ非null
}
export interface Bucket { key: string; label: string; matches: number; wins: number; losses: number }
export const UNREGISTERED_SERIES_KEY: string;   // 大会シリーズ未登録（NULL/空）の専用区分キー。登録済みシリーズ名と衝突しない値にする
export const UNREGISTERED_SERIES_LABEL = "その他"; // 表示名
export function aggregateByDimension(matches: DecidedMatch[], dim: Dimension): Bucket[];
// 固定区分（category: 男子/女子/混合の3区分のみ、season: 春夏秋冬）は試合0件でも全区分を返す。
// category に「未設定」区分は存在しない。部門を判別できない試合（SINGLES/DOUBLES かつ genderDivision=null）は category 集計から除外する。
// 動的区分（venue/surface/series/opponent）は試合のある値のみ。「未設定」区分（旧 UNSET_KEY / UNSET_LABEL）は全次元で廃止する。
// - surface: surface=null の試合は集計から除外する（区分を作らない）。区分は登録値（ハード/クレー/人工芝/その他(OTHER)）のみ。
// - series: seriesName が null/空の試合は UNREGISTERED_SERIES_KEY の1区分（label「その他」）に集計し、一覧の末尾（登録済みシリーズの全区分より後）に置く。
//   区分キーは「登録済みシリーズ名そのもの」ではなく名前空間付きのキーで管理する（例: 登録済みは `series:${name}`、未登録は UNREGISTERED_SERIES_KEY = "unregistered"
//   のように、登録済みキーと決して一致しない形式）。登録済みシリーズの名称が「その他」でも、label「その他」の区分が2つ並ぶだけで合算しない
//   （登録済み側は登録済みの並びの中、未登録側は末尾）。
// - 空の会場名は venue 集計から除外。opponent は団体戦（opponentTeamName != null）のみ対象。
// 動的区分の並び順: 試合数降順 → ラベル昇順。ただし series の UNREGISTERED_SERIES_KEY は試合数にかかわらず常に末尾。

// history.ts
export function sortHistoryDesc<T extends { recordedAt: string; seq: number }>(rows: T[]): T[]; // 日時降順、同一日時は seq 降順
export function toChartSeries<T extends { recordedAt: string; seq: number }>(rows: T[]): T[];   // 昇順、全件
export function formatDelta(diff: number): { text: string; direction: "up" | "down" | "flat" }; // "+8" / "−6" / "±0"

// chartAxis.ts（GranChart の軸計算。描画から独立した純粋関数）
export interface NiceTicks { ticks: number[]; min: number; max: number; step: number } // min=ticks[0], max=ticks[last]
export function niceTicks(dataMin: number, dataMax: number, targetCount?: number /* 既定5 */,
  bounds?: { floor?: number; ceil?: number } /* 目盛りの下限・上限。GranChart は { floor: 100, ceil: 999 } を渡す */): NiceTicks;
// - 刻み幅 step は 1・2・5 × 10^k の正の整数（step >= 1）。ticks は min から max まで step 間隔の整数列（等間隔）。
// - min = floor(dataMin / step) * step、max = ceil(dataMax / step) * step（データ範囲をすべて含む）。
// - ticks が3個未満になる場合（dataMin = dataMax、または範囲が狭い）は、step を 1・2・5 系列で1段階ずつ縮めて3個以上にする。
//   dataMin = dataMax で step=1 でも足りない場合は [v-1, v, v+1] とする（bounds 指定時は余白適用後の範囲が常に幅を持つため到達しない）。
// - bounds 指定時: 上記で得た min < floor または max > ceil になる場合は、step を 1・2・5 系列で1段階ずつ縮めて
//   floor <= min かつ max <= ceil を満たすまで再計算する（切り詰めず、等間隔と3個以上を維持する）。step=1 なら
//   dataMin/dataMax が [floor, ceil] 内であるかぎり必ず満たされるため、ループは必ず終了する。

// 余白とクランプ（要件3.14, 3.15）。GranChart が niceTicks に渡す前に適用する。
export function paddedLevelRange(min: number, max: number, padding = 50, floor = 100, ceil = 999): { lo: number; hi: number };
// - lo = max(floor, min − padding)、hi = min(ceil, max + padding)。クランプ（3.15）が余白（3.14）より優先。
// - 入力は 100 <= min <= max <= 999 の整数（変動後レベル）。出力は floor <= lo <= min、max <= hi <= ceil。
// - GranChart: const { lo, hi } = paddedLevelRange(lMin, lMax); const yAxis = niceTicks(lo, hi, 5, { floor: 100, ceil: 999 });
//   最終的な縦軸範囲 [yAxis.min, yAxis.max] は [lo, hi] を含み、100〜999 に収まる（要件3.16）。
export interface DateTick { date: string /* YYYY-MM-DD */; label: string }
export function dateTicks(dates: string[] /* 確定日付 YYYY-MM-DD、重複・未整列可 */, maxCount?: number /* 既定5 */): DateTick[];
// - 重複を除いた日付種類数 n に対し、n <= maxCount なら全種類、n > maxCount なら先頭・末尾を含み添字を等分割で maxCount 個選ぶ（個数は min(n, maxCount)、n>=3 なら3以上）。
// - 昇順で返す。label は全目盛りで1形式に統一: 全日付が同一年なら "M/D"、年をまたぐなら "YYYY/MM/DD"。

// chartTooltip.ts（Chart_Tooltip の位置計算。DOMに依存しない純粋関数）
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface TooltipPlacement { left: number; top: number; placement: "above" | "below" }
export function tooltipPosition(args: {
  anchor: { x: number; y: number };        // 点の中心（描画領域と同じ座標系）
  size: { width: number; height: number }; // ツールチップの実寸（描画後に測定）
  bounds: Rect;                            // グラフの描画領域（plot area）
  gap?: number;                            // 点とツールチップの間隔。既定 12
}): TooltipPlacement;
// - 前提: size.width <= bounds の幅 かつ size.height <= bounds の高さ（呼び出し側が max-width と文言の折り返しで保証する。超える場合は left/top を bounds.left / bounds.top に固定）。
// - 水平: 点の中心に揃える left = anchor.x − width/2 を、[bounds.left, bounds.right − width] にクランプする（端の点では内側へ寄せる。要件3.20）。
// - 垂直: まず点の上側 top = anchor.y − gap − height（placement="above"）に置く。top < bounds.top で収まらない場合は点の下側 top = anchor.y + gap（placement="below"）に置く。
//   下側でも bottom を超える場合は [bounds.top, bounds.bottom − height] にクランプする（どちらにも収まらない極端な場合でも領域外へ出さない）。
// - 出力の矩形 [left, top, left+width, top+height] は常に bounds に収まる（前提を満たす入力のとき）。
// - 点が bounds 内で、上側に収まるときは placement="above"、収まらず下側に収まるときは "below"。

// participation.ts
export interface ParticipationFilter { division?: GenderDivision; tier?: TournamentTier; year?: number }
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
| `/api/data/participations` | `division`(`MEN`/`WOMEN`/`MIXED`),`tier`,`year`,`order`(`asc`/`desc`、既定desc),`offset`,`limit`(既定20) | `{ rows: ParticipationRowDto[]; total; nextOffset; years: number[] }` |
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
- `GranHistory` / `GranChart`: 一覧20件+「もっと見る」。`GranChart` は自前SVG折れ線。各点は `tabindex=0` / `role="button"` でフォーカスでき（44px以上の当たり判定の透明円）、**点の近くの Chart_Tooltip** に日付（YYYY/MM/DD）・大会名・変動後レベルを表示する（要件3.6, 3.18〜3.25）。従来の「グラフ下部に選択点の情報を表示する `<p aria-live>` と、未選択時の案内文『グラフの点を選択すると詳細が表示されます。』」は**削除**する（要件3.21）。グラフ下部の `NOTE_CLASS` の期間・レベル範囲（先頭〜末尾の確定日時、最小〜最大レベル）は選択点の情報ではないため維持する。
  - **Chart_Tooltip（要件3.6, 3.18〜3.25）**:
    - **状態**: `activeIndex: number | null` を単一の状態として持つ。1つの state で表すため、同時に表示されるツールチップは構造的に1個以下になる。別の点で表示するときは `activeIndex` を置き換えるだけで、前のツールチップは閉じる（要件3.25）。
    - **開く/閉じる**: (1) ホバー: 点の `<g>` の `onPointerEnter` で開き、`onPointerLeave` で閉じる（`pointerType === "mouse" | "pen"` のときのみ。タッチでは合成の enter/leave を無視する。要件3.6, 3.22）。(2) キーボード: `onFocus` で開き、`onBlur` で閉じる。ただし `blur` は `activeIndex` がそのフォーカス点と一致するときだけ閉じる（要件3.18, 3.23）。(3) タッチ: 点の `onPointerDown`（`pointerType === "touch"`）で開く（要件3.19）。外側タップで閉じるため、`activeIndex !== null` の間だけ `document` に `pointerdown` リスナーを登録し、`pointerType === "touch"` かつイベント対象が現在の点の `<g>` の外であれば閉じる。別の点をタップした場合は、その点の `onPointerDown` が `activeIndex` を置き換える（要件3.24, 3.25）。リスナーは `useEffect` のクリーンアップで解除する。
    - **描画**: ツールチップはSVG外の絶対配置の `<div>`（ラッパー `div` が `relative`）として描画し、`pointer-events-none` にする（ホバー中の点を覆って `pointerleave` を発火させないため）。ラッパーの座標系と SVG の `viewBox` は縮小率1で一致する（サイズ項の `ResizeObserver` で `viewBox` 幅を実幅に一致させているため）。
    - **位置**: 点の中心 `(xs[i], ys[i])`、描画領域 `bounds = { left: MARGIN_L, top: MARGIN_T, right: W − MARGIN_R, bottom: MARGIN_T + plotH }`、`useLayoutEffect` で測定したツールチップ実寸を `tooltipPosition` に渡し、返った `left` / `top` を `style` に設定する（測定前は `visibility: hidden` にしてちらつきを防ぐ）。幅は `max-width: min(240px, plotW)` とし、大会名が長い場合は折り返す（`break-words`）。これにより「実寸 ≦ 描画領域」の前提を満たす。グラフの左右端の点では内側に寄せ、上端付近の点では下側に置く（要件3.20）。
    - **内容と書式**: 「YYYY/MM/DD」（日付のみ。時刻は表示しない）、大会名、「変動後レベル N」を3行で表示。日付の整形は `shared.ts` に日付のみの整形関数（例: `formatDate`）が無ければ追加する（既存 `formatDateTime` は時刻を含むため流用しない）。ツールチップの文字は 12px 以上、`bg-white dark:bg-slate-900`・`text-slate-900 dark:text-slate-100`・`border-slate-200 dark:border-slate-700`・`rounded-xl`・影付きとし、コントラスト 4.5:1 以上を保つ（要件10.8, 10.9）。
    - **アクセシビリティ**: ツールチップ要素に `role="tooltip"` と、`useId()` で生成した一意の `id` を付ける。表示中の点の `<g>` に `aria-describedby={tooltipId}` を付ける（非表示の点には付けない。存在しない要素を参照しないため）。点の `aria-label`（日付・大会名・変動後レベル）は維持する。従来の `aria-pressed`（選択状態）は選択の概念が無くなるため削除する。色だけに依存せず、アクティブな点は塗りつぶしと半径拡大（現状の `isSel` 表現）で示す（要件10.6）。
  - **軸と補助線（要件3.11〜3.16）**: 縦軸は、まず `paddedLevelRange(最小変動後レベル, 最大変動後レベル)`（既定: 余白±50、下限100、上限999）で目標範囲 `[lo, hi]` を求め（クランプが余白より優先、要件3.14, 3.15）、次に `niceTicks(lo, hi, 5, { floor: 100, ceil: 999 })` の `ticks` を等間隔の整数ラベルとして左に描画する。軸範囲は `[ticks[0], ticks[last]]` で、`[lo, hi]` を含む最小のきりの良い範囲に広がってよいが、100〜999 を超えない（要件3.16）。データの最小・最大の点は必ず軸範囲内に収まる。Y座標は `ticks[0]`〜`ticks[last]` を描画域の下端〜上端へ線形に割り当てる。各目盛りに水平補助線（`<line data-gridline>`）を引き、本数は目盛りラベル数と同数。横軸は `dateTicks(全点の確定日付)` の各 `date` に対応するX位置（時刻に比例）へ目盛り線とラベルを描画する（形式は1種類に統一、日付種類が3未満ならその数）。補助線は `stroke` に `slate-200 / dark:slate-700` を使い、軸ラベルは `text-slate-700 dark:text-slate-300` の12px以上とする。
  - **サイズ**: SVGは `viewBox` の縮小でフォントが12px未満にならないよう、`ResizeObserver` でコンテナ実幅（最小280px）を取得し、`viewBox` 幅を実幅に一致させる（縮小率1）。左余白は縦軸ラベル幅、下余白は横軸ラベル幅を確保する。横ラベルが重なる幅では `dateTicks` の `maxCount` を幅から算出して減らす（ただし3個以上、日付種類が3未満ならその数）。
  - **データ表は設けない（要件3.17, 10.7）**: 従来の `<details>`「グラフの全データを表で見る」と全点データ表は**削除**する。グラフの値は、縦軸・横軸の目盛りラベル、点のホバー/フォーカス/タップで表示される Chart_Tooltip、同一画面内の履歴一覧（`GranHistory`）で確認する。履歴一覧はグラフ専用の表ではなく、グラフの全点を含む保証もない（初期20件+もっと見る）ため、専用表とは扱わない。
- `RecordSummary` / `RecentMatches`: 勝敗は「勝」「敗」の文字+色の両方（要件4.4）。Participation_Pageへのリンク。
- `WinRateByCondition`: 条件選択は**プルダウン**（ネイティブ `<select>` + `<label htmlFor>`「条件」。選択肢は種目・会場・サーフェス・季節・対戦相手（団体戦）・大会シリーズの6つをこの順で）。タブ（`role="tablist"`）は使わない（要件5.1）。`onChange` で `dimension` を更新し、変更前の集計結果を変更後の結果に置き換える（要件5.12）。`select` は `min-h-[44px]`、`text-sm` 以上、`rounded-xl`、`ui-design-system.md` の入力トークン（`border-slate-200 dark:border-slate-800`、フォーカスリング `emerald`）を使う。再読み込みは現在の `dimension` で再取得する（要件5.13）。区分ごとに「試合数/勝/敗/勝率(整数%)」の行と、勝率に比例した幅の横棒（0試合は「-」・幅0）。種目を選んだ場合の区分は男子・女子・混合の3行のみで「未設定」行は出さない。どの条件でも「未設定」行は表示しない（要件5.15）。サーフェスはサーフェスが登録された試合のみを登録値ごとに表示し、未登録（NULL）の試合は除外する（要件5.8, 5.16）。大会シリーズは、シリーズ未登録の試合があるときだけ「その他」行（`UNREGISTERED_SERIES_KEY`）を登録済みシリーズの全行の後ろ（末尾）に表示し、登録済みシリーズに「その他」があっても別の行として並べる（要件5.14）。行の React `key` には `Bucket.key`（名前空間付き）を使うため、同じ表示名「その他」の行が2つあっても衝突しない。会場は `tournaments.venue` が必須列のため「未設定」を持たず、空文字の会場名は会場別集計から除外する。サーフェスで全試合がサーフェス NULL の場合など、区分が0件になるときは既存の「集計対象の試合がありません。」の空状態を表示する。
- `ParticipationTable`: md以上は表、md未満は「開催年月日・会場・結果」の3項目のカード行で横スクロールなし（要件6.6）。行は `role="button"` `tabIndex=0`、Enter/Spaceで選択、`min-h-[44px]`（要件7.6）。
- `ParticipationDetail`: `role="dialog"` `aria-modal`。開くとき `history.pushState({ detail: tournamentId }, "")`、`popstate`・Esc・閉じるボタンで閉じ、直前に押下した行へ `focus()` を戻す。一覧コンポーネントはマウントしたまま背面に残すため、スクロール位置と絞り込み状態が保持される（要件7.5, 7.7）。
- `RankingView`（`src/components/ranking/RankingView.tsx`）: 上部1か所に「階級別 / 種目別」切替（モード切替は2タブのまま）。階級別では**8個のTierタブを廃止**し `TierSlider` を表示する。種目別は従来どおり種目タブ（男子/女子/混合）。選択状態は親の `useState`（`{ mode, tier, category }`）に保持し、モード切替で破棄しない（要件9.6）。初期の階級は `initialSliderTier(現在のTier | null)`（`page.tsx` が現在Tierを判定できない場合は `null` を渡し、A を初期選択する。要件8.14）、初期の種目は男子。
- `TierSlider`（新規、`src/components/ranking/TierSlider.tsx`）: ネイティブ `<input type="range" min={0} max={7} step={1}>` を使う。
  - 値は `tierToSliderValue(tier)`、`onChange` では `sliderValueToTier(Number(e.target.value))` で親の `tier` を更新する。ネイティブ `range` は `step=1` によりドラッグ・タップ時に最寄りの整数位置へスナップし、中間位置では停止しない（要件8.13）。矢印キー（←↓で1段階下位、→↑で1段階上位）、Home/End、PageUp/PageDown の操作と、両端を超えない挙動もブラウザが提供する（要件8.12）。独自キーハンドラは持たない。
  - 値の配置は左端 DE から右端 A（値が増える方向が上位）とし、矢印キーの方向（→/↑ = 上位）と一致させる。スライダー直下に全8階級名（DE〜A の並びで左から右）を目盛りとして表示する。
  - アクセシビリティ: `<label htmlFor>`「階級」を関連付け、`aria-valuetext={`${tier}級`}` で階級名を読み上げさせる（`aria-valuenow` は数値のため）。`aria-valuemin/max` はネイティブ属性に委ねる。つまみ周辺のタップ領域は高さ `min-h-[44px]` 以上。フォーカスリングは `emerald`。
  - 選択中のTier名を、スライダー近傍（右上または直上）に「選択中: AB級」の形式で常時表示する（要件8.1）。
  - 該当者0人・取得失敗のときもスライダーは `disabled` にしない（要件8.7, 8.11）。値の変更で `RankingList` が `key` により再マウントされ、直前の選択位置は `tier` state に保持される。
  - ドラッグ中は値が変わるたびに取得が起動するため、`useRemoteResource` の `AbortController` で直前の未完了リクエストを破棄し、最後の位置の結果のみを表示する。

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

-- tournaments への列追加（DB上はすべてNULL許容。series_id は未登録を許容し「その他」区分に集計、
-- surface / gender_division はアプリ層（zod）で必須。既存の surface NULL は集計から除外し補完しない）
ALTER TABLE tournaments ADD COLUMN surface TEXT
  CHECK (surface IN ('HARD','CLAY','ARTIFICIAL_GRASS','OTHER'));
ALTER TABLE tournaments ADD COLUMN series_id TEXT REFERENCES tournament_series(id);
ALTER TABLE tournaments ADD COLUMN gender_division TEXT
  CHECK (gender_division IN ('MEN','WOMEN','MIXED'));
-- gender_division は SQLite の制約上 NULL 許容列として追加するが、運用上は必須。
-- 団体戦は category から一括補完（冪等）。SINGLES/DOUBLES は登録・更新時に zod で必須化する。
UPDATE tournaments SET gender_division = CASE category
    WHEN 'MEN_TEAM' THEN 'MEN' WHEN 'WOMEN_TEAM' THEN 'WOMEN' WHEN 'MIX_TEAM' THEN 'MIXED' END
 WHERE gender_division IS NULL AND category IN ('MEN_TEAM','WOMEN_TEAM','MIX_TEAM');

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

プロパティ・リフレクションの結果: 「履歴の降順」「出場履歴のページング」「ランキングの50件ページング」は同一の `slicePage` 性質に統合した。「3.5の符号表記」と「7.4の変動表記」は `formatDelta` に統合した。「勝率の算出」「勝率の整数表示/0試合」は `winRate` の性質に統合した。階級別と種目別のレベル一致は、ランキングDTOの生成元が同一であることとして1つにまとめた。グラフ軸（縦軸の整数・等間隔・範囲包含・3個以上）は `niceTicks` の1性質に、スライダー（往復変換・スナップ・端のクランプ・初期値）は Tier⇔スライダー値の1性質に統合した。補助線の本数一致（要件3.13）は `ticks` から生成する構造により Property 17 に帰着させ、描画上の本数は例示テストで確認する。縦軸の余白とクランプ（要件3.14〜3.16）は `paddedLevelRange` と `niceTicks` の合成として Property 20 にまとめた。Chart_Tooltip の位置（要件3.20）は `tooltipPosition` の1性質として Property 21 にまとめた。開閉の状態遷移（ホバー/フォーカス/タップ/外側タップ、同時1個以下。要件3.6, 3.18, 3.19, 3.21〜3.25）と `role="tooltip"` / `aria-describedby` は、入力空間が小さくUIイベントに依存するため、プロパティではなくコンポーネントの例示テストで検証する。

### Property 1: 階級判定と昇格情報の整合

*For any* GRANレベル（100〜999の整数）に対し、`computePromotion` は (a) 8階級のうちちょうど1つの階級を返し、階級の範囲 `[tierLowerBound, tierUpperBound]` に当該レベルが含まれる、(b) 最上位階級（A）以外では、次階級の下限値が閾値となり `pointsToGo = 閾値 − レベル` は1以上、`progressPercent` は0〜100に収まる、(c) 最上位階級では `next` が `null` になる。

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

### Property 2: 勝率の算出と表示

*For any* 非負整数 `wins ≤ total` に対し、`total = 0` なら勝率は `null`（表示「-」、棒の長さ0）、`total > 0` なら `winRatePercent1` は 0.0〜100.0 で小数第1位までの値、`winRatePercentInt` は 0〜100 の整数であり、`winRatePercentInt` は `winRatePercent1` を整数に四捨五入した値と一致する。

**Validates: Requirements 4.1, 5.6, 5.7**

### Property 3: 条件別集計は試合を丁度1区分に分類する

*For any* 勝者確定済み試合の集合と任意の `Dimension` に対し、`aggregateByDimension` が返す区分について、(a) 各区分で `wins + losses = matches`、(b) 区分の `matches` の合計は対象試合数と等しい（`opponent` は団体戦のみ、`category` は部門を判別できる試合のみ、`venue` は会場名が空でない試合のみ、`surface` は `surface` が登録されている試合のみ。`surface` が `null` の試合は合計に含まれない）、(c) どの `Dimension` の結果にも「未設定」という `label` の区分は現れない、(d) `category` はどの入力に対しても男子・女子・混合の3区分のみ（この順）、`season` は春夏秋冬の4区分を常に返す。団体戦（`MEN_TEAM`/`WOMEN_TEAM`/`MIX_TEAM`）は `genderDivision` が `null` でも `category` から部門が決まる。(e) `series` では、シリーズ未登録の試合の数を `u` とすると `u > 0` のときちょうど1つの区分（`key = UNREGISTERED_SERIES_KEY`、`label = "その他"`、`matches = u`）が存在し、その区分は結果の末尾にある。`u = 0` のとき、その区分は存在しない。(f) 登録済みシリーズの名称が「その他」の試合が含まれていても、その試合の区分は `UNREGISTERED_SERIES_KEY` の区分とは別のキーで集計され、2つの区分の `matches` / `wins` / `losses` は合算されない（登録済み区分の試合数は、登録名が「その他」の試合数と等しい）。入力に `FINISHED` でない試合や個人戦（`opponent` 次元）は含まれない（呼び出し側のフィルタ後を前提に、集計関数は入力を過不足なく数える）。

**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.8, 5.9, 5.14, 5.15, 5.16**

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

### Property 17: 縦軸の目盛りは整数・等間隔・3個以上でデータ範囲を含む

*For any* 整数の最小値 `dataMin` と最大値 `dataMax`（`dataMin ≤ dataMax`、同値を含む）に対し、`niceTicks` が返す `ticks` は (a) 3個以上、(b) すべて整数、(c) 隣接する目盛りの差がすべて等しい正の値（`step`）、(d) `ticks[0] ≤ dataMin` かつ `dataMax ≤ ticks[last]`、(e) `min = ticks[0]`、`max = ticks[last]` である。さらに、`bounds = { floor: 100, ceil: 999 }` を指定し `100 ≤ dataMin ≤ dataMax ≤ 999` の場合は (f) `100 ≤ ticks[0]` かつ `ticks[last] ≤ 999` も成り立つ（(a)〜(e) は維持される）。これにより、水平補助線の本数（`ticks` と同数）と範囲内に収まる最小・最大の点が保証される。

**Validates: Requirements 3.12, 3.13, 3.16**

### Property 18: 横軸の日付目盛りは個数・形式・順序を満たす

*For any* 確定日付（`YYYY-MM-DD`）の集合（重複・未整列を含む、1件以上）に対し、`dateTicks` が返す目盛りは (a) 入力に存在する日付のみで構成され昇順で重複がない、(b) 個数は `min(日付の種類数, maxCount)` で、種類数が3以上かつ `maxCount ≥ 3` なら3個以上、(c) 全ラベルが同一の形式（全日付が同一年なら `M/D`、そうでなければ `YYYY/MM/DD`）、(d) 種類数が `maxCount` を超えるときも最初と最後の日付を含む。

**Validates: Requirements 3.11**

### Property 19: Tier とスライダー値の変換

*For any* Tier に対し、`sliderValueToTier(tierToSliderValue(tier)) = tier` が成り立ち、`tierToSliderValue` は 8 つの Tier を 0〜7 の相異なる整数に写し、上位の Tier ほど大きい値になる（DE=0, A=7）。*For any* 実数 `raw` に対し、`snapSliderValue(raw)` は 0〜7 の整数であり、`raw` が 0〜7 の範囲内なら元の `raw` との距離が全整数位置のうち最小（最寄りの離散位置）である。*For any* 値 0〜7 と `delta ∈ {+1, −1}` に対し、`stepSliderValue` は範囲内なら `value + delta`、端（0 で −1、7 で +1）を超える場合は値を変えない。*For any* Tier または `null` に対し、`initialSliderTier(null) = "A"`、`initialSliderTier(tier) = tier` である。

**Validates: Requirements 8.1, 8.2, 8.12, 8.13, 8.14**

### Property 20: 縦軸範囲は ±50 の余白と 100〜999 のクランプを満たす

*For any* 整数の `lMin ≤ lMax`（ともに 100〜999）に対し、`{ lo, hi } = paddedLevelRange(lMin, lMax)` は (a) `lo = max(100, lMin − 50)`、`hi = min(999, lMax + 50)`、(b) `100 ≤ lo ≤ lMin` かつ `lMax ≤ hi ≤ 999` である。さらに `yAxis = niceTicks(lo, hi, 5, { floor: 100, ceil: 999 })` について、(c) `100 ≤ yAxis.min ≤ lo` かつ `hi ≤ yAxis.max ≤ 999`（最小値・最大値の点が範囲内に収まる）、(d) 広がり幅は刻み幅未満（`lo − yAxis.min < step` かつ `yAxis.max − hi < step`、ただし 100〜999 の境界に達している側を除く）、(e) `ticks` は Property 17 の (a)〜(c) を満たす（3個以上・整数・等間隔）。

**Validates: Requirements 3.14, 3.15, 3.16**

### Property 21: Chart_Tooltip は常に描画領域内に収まる

*For any* 描画領域 `bounds`（幅・高さが正）、その領域内の任意の点 `anchor`、`bounds` の幅・高さ以下の任意のツールチップ実寸 `size`、非負の `gap` に対し、`tooltipPosition` が返す矩形 `[left, top, left + width, top + height]` は (a) 常に `bounds` に完全に収まる（4辺とも）、(b) `anchor` が左右端付近でも水平方向は内側へ寄せられ、領域に収まる場合は点の中心に揃う（`left = anchor.x − width/2`）、(c) 点の上側に収まるとき `placement = "above"` で `top = anchor.y − gap − height`、上側に収まらず下側に収まるとき `placement = "below"` で `top = anchor.y + gap`、(d) どちらにも収まらない場合も (a) を満たす。

**Validates: Requirements 3.20**

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
- ランキング: 階級別ではTier_Sliderの選択位置、種目別では選択中タブを保持し、直前の順位表を保持（要件8.11, 9.10）。

空状態: 履歴0件（要件3.7）、試合0件（4.6）、集計対象0件（5.10）、出場履歴0件（6.7、大会日程 `/tournaments` へのリンク付き）、絞り込み0件（6.8、条件解除ボタン付き）、階級/種目の該当者0人（8.7, 9.9）。

データ不整合への防御: `gran_level` が100〜999外、未知の `rank_type`、`entry2_id` NULL（不戦）の試合は、画面を落とさず集計から除外する（SQL条件とTSの型ガードで処理）。

## Testing Strategy

本機能は純粋なロジック（階級計算、集計、順位付け、ページング、匿名化）を多く含むため、**プロパティベーステストを採用**する。UI描画、ルーティング、スキーマ追加はPBTの対象外で、例示テストとスモークテストで検証する。

### ツールとセットアップ

現状 `package.json` にテスト基盤が無い。devDependenciesに `vitest` と `fast-check` を**バージョン固定**で追加し、`"test": "vitest --run"` を追加する（実行は単発。ウォッチ不使用）。UI部品のテストが必要な場合のみ `@testing-library/react` と `jsdom` を追加する。パスエイリアス `@/` は `vitest.config.ts` で `tsconfig` と合わせる。

### プロパティテスト

- 対象は Property 1〜21。各プロパティを**単一のプロパティテスト**で実装し、`fc.assert(..., { numRuns: 100 })` 以上（最小100回）で実行する。
- 各テストにタグコメントを付ける。形式: `// Feature: data-tab-restructure, Property {番号}: {プロパティ名}`。
- Property 10 はインメモリ `new DatabaseSync(":memory:")` に必要テーブルを作成し、`createDataRepository(db)` に注入して実行する（`NOW_JST` 依存の日付は固定の過去日で生成）。反復1回あたりが軽いため100回実行する。
- Property 15, 16 は DTO 変換関数/`opponentLabel` に対して、任意文字列の氏名・メールなどを生成して検査する。
- ジェネレータは、境界値（レベル100/999/各階級境界、勝敗0件、同値レベル、同日試合）を含むよう `fc.constantFrom` と `fc.integer` を併用する。

### 例示テスト・単体テスト

- ルートハンドラ: 未ログイン→401、`userId` 不一致→403、自分のデータのみ返却（要件11.1〜11.3）。`next/headers` の `cookies` をモックして実行。
- 出場詳細: 未確定時の表示、GRAN変動の表示、未出場大会の404。
- `useRemoteResource`: フェイクタイマーで10秒タイムアウト、3回連続失敗、`keepStaleOnError` の有無（要件2.9, 10.2〜10.4）。
- コンポーネント: タブの順序と `aria-current`、勝敗の文字+色併用、行のキーボード操作（Enter/Space）、ダイアログのEsc/戻る/フォーカス復帰、ランキングのモード切替後の選択状態の復元（要件1.1, 4.4, 7.5, 7.6, 9.6）。
- `GranChart`: 縦軸ラベルが3個以上、水平補助線（`[data-gridline]`）の本数が縦軸ラベル数と一致、横軸ラベルの形式が1種類、`<table>` / `<details>` が存在しない（要件3.11〜3.17, 10.7）。**Chart_Tooltip のテスト（要件3.6, 3.18〜3.25）**: (1) 点に `pointerenter`（mouse）で `role="tooltip"` が表示され、YYYY/MM/DD・大会名・変動後レベルを含み、`pointerleave` で消える。(2) 点への `focus` で同内容が表示され、`blur` で消える。(3) `pointerType: "touch"` の `pointerdown` で表示され、点以外への touch `pointerdown` で消える。(4) 別の点を表示すると前のツールチップが消え、`role="tooltip"` 要素は常に1個以下（ホバーA→ホバーB、フォーカスA→タップB の組み合わせを含む）。(5) 表示中の点に `aria-describedby` がツールチップの `id` と一致して付き、非表示の点には付かない。(6) グラフ下部に選択点の情報を示す要素（旧 `aria-live` の段落と案内文）が存在しない（要件3.21）。(7) 左端・右端・最小/最大レベルの点でツールチップの `left` / `top` が描画領域内に収まる（`getBoundingClientRect` はjsdomで0になるため、`tooltipPosition` をモックせず、`offsetWidth` / `offsetHeight` を固定値で差し込むか、位置の検証はProperty 21に委ね、コンポーネントテストでは `style` が `tooltipPosition` の出力と一致することのみ確認する）。日付種類が2のとき横ラベルが2個になる境界例も確認する。縦軸は、変動後レベルの最小・最大に ±50 の余白がある例（例: 400〜500 → 範囲が 350〜550 を含む）、下端クランプの例（最小 120 → 下端 100）、上端クランプの例（最大 980 → 上端 999 以下）で、ラベルの最小値・最大値が 100〜999 に収まり全点が範囲内に描画されることを確認する。
- `WinRateByCondition`: `<select>` に `<label>` が関連付けられ、選択肢が6つで順序どおり、`role="tablist"` が存在しない。種目を選んだときの行は男子・女子・混合のみで「未設定」が出ない。どの条件でも「未設定」が出ない。サーフェスはサーフェス NULL の試合が行にならず、大会シリーズは未登録の試合があるときだけ末尾に「その他」行が出て、登録済みシリーズの「その他」は別の行として登録済みの並びの中に出る（要件5.8, 5.14〜5.16）。条件変更で表示が置き換わり、再読み込みが現在の条件で再取得する（要件5.1〜5.3, 5.8, 5.12, 5.13）。
- `TierSlider` / `RankingView`: 階級別で `input[type=range]`（min=0, max=7, step=1）が1つあり、階級を表すタブが存在しない。`aria-valuetext` が「◯級」、選択中Tier名がスライダー近傍に表示される。現在Tier不明（`null`）で初期値A。←↓/→↑ の `keydown` 相当の操作で1段階移動し、DE・Aの端で変化しない。値変更で順位表のリクエストURLの `tier` が変わる。該当者0人・取得失敗でもスライダーが `disabled` でない（要件8.1〜8.3, 8.7, 8.11〜8.14）。ネイティブ `range` のドラッグ時スナップはブラウザ実装のため、自動テストではなく手動確認とする。
- **大会登録・更新のスキーマ（`src/features/tournaments/types/__tests__/schema.test.ts` に追加）**: `tournamentCreateSchema` が `surface` の未指定・`null`・不正値（例: `"UNSET"`）を拒否し、4つの登録値を受け付ける。`validateTournamentUpdate` は、`surface` を指定しない更新で既存値が有効なら成功し、既存値が NULL（旧データ）なら拒否する。`createTournament` が `surface` / `series_id` を INSERT し、`surface` 未指定で `ZodError` になる。
- **リポジトリ単体テストの更新（`src/features/data/server/__tests__/dataRepository.test.ts`）**: 既存テスト「サーフェス・大会シリーズの未登録は『未設定』区分に入る」は新仕様と矛盾するため、次の2テストに置き換える（フィクスチャの `t06` はサーフェス NULL の旧データ、`t04` はシリーズ未登録のまま利用する）。
  - 「サーフェス未登録（旧データ）の試合はサーフェス別集計から除外される」: `aggregateByDimension(matches, "surface")` に `key === "UNSET"` の区分と `label === "未設定"` の区分が無いこと、区分の `matches` 合計が「通算試合数（14） − `t06` の試合数（2）」と一致すること、`getRecord` の通算試合数は 14 のまま（サーフェス NULL の試合も通算には含む）ことを検証する。
  - 「シリーズ未登録の試合は末尾の『その他』区分に入る」: `"series"` の結果の末尾が `key === UNREGISTERED_SERIES_KEY` かつ `label === "その他"` で `matches === 1`（`t04`）であること、どの区分も `label === "未設定"` でないことを検証する。
  - 追加: 「登録済みシリーズ『その他』と未登録の『その他』は合算されない」。フィクスチャに名称「その他」の登録済みシリーズ（例: `FIXTURE_SERIES.other`）を足すと既存の他テストの件数が変わるため、既存大会のシリーズは変更せず、`aggregateByDimension` に `seriesName: "その他"` の `DecidedMatch` と `seriesName: null` の `DecidedMatch` を直接与える純粋関数テスト（`aggregate.test.ts`）で検証する。リポジトリ層ではDBの `LEFT JOIN tournament_series` の結果（`series_name` が NULL）が `seriesName: null` に写ることのみを確認する。
  - 他の既存テスト（種目3区分、季節の合計14、対戦相手別）は変更しない。
- `ensureColumn` / 補完: 団体戦の既存行で `gender_division` が `category` から補完され、2回実行しても結果が変わらない。`SINGLES`/`DOUBLES` で `gender_division` 未指定の大会登録が 400 になる。
- スケルトン表示が取得開始の同一レンダーで出ること（200ms以内の保証は実装構造で担保）。

### スモーク・統合

- `navConfig` の `data` 項目が `implemented: true` かつ `href: "/data/me"`（要件1.4）。
- 各ページが `max-w-4xl` を含む（要件1.6）。
- `createDatabase()` を既存DBファイル相当のスキーマに対して2回実行しても、`ensureColumn` が冪等であること。
- 手動確認（自動化しない）: ダーク時のコントラスト4.5:1、320px幅でのレイアウト崩れ、スクリーンリーダー読み上げ。WCAG準拠の完全な検証には、支援技術を使った手動テストと専門家レビューが必要である。

### 開発用データ

`scripts/seed.ts` に、試合・結果・シリーズ・サーフェス・性別区分を含むサンプルデータ投入を追加し、全画面の手動確認に使えるようにする（ゲスト、不戦、未確定結果、引き分け、同値レベルのケースを含める）。サーフェスは全大会に登録可能な値を設定する（`t4` も含む。必須化後は NULL を作らない）。大会シリーズ未登録（`series: null`）の大会は「その他」区分の確認用に残す。サーフェス NULL の旧データは `src/test/fixtures/dataTabFixture.ts` の `t06` のみで再現する。
