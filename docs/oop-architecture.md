# GRAN バックエンド OOP アーキテクチャ標準

本書は、テニス大会運営アプリ「GRAN」のバックエンドを、現状の「モジュールレベルの純粋関数 + リポジトリ関数」スタイルから、クラスベース・オブジェクト指向（OOP）パラダイムへ再設計するための標準である。採用方針はユーザー合意済みの **A案（エンティティ / 値オブジェクト / ドメインサービス / リポジトリを class として再設計）** とする。

本リファクタリングは **ビヘイビア保存リファクタリング（behavior-preserving refactoring）** である。ユーザーから観測可能な動作、DBスキーマ（`src/lib/db.ts` の `CREATE TABLE`）、Server Action の外部契約（引数・戻り値の形）は一切変更しない。変えるのは内部構造だけである。

本書は `.github/Antigravity-instructions.md`（以下「既存規約」）の下位・補完文書である。既存規約の全ルール（命名規則、`any` 禁止、セマンティックトークン、早期リターン、トランザクション義務、安全なエラーメッセージ等）は OOP 化後も維持・準拠する。両者が衝突した場合は既存規約を優先し、本書を改訂して整合させる。

**既存規約 §1.2 の「共有昇格先」の拡張（本リファクタリングで規約側も改訂する）**: 既存規約 §1.2 は、機能間で共有するロジック・型の昇格先を「ルートの `components` / `types` / `utils` へ昇格、または Props / Context 経由で注入」と列挙している。本書が新設する共有ドメイン基盤（`src/domain/`）・Unit of Work（`src/lib/unitOfWork.ts`）・コンポジションルート（`src/server/container.ts`）は、この列挙に**含まれない新ルート要素**である。これは §1.2 への「準拠」ではなく**拡張**であり、クラス/VO を型でも純関数でもない `utils/` に押し込む代替案は設計意図に反する。したがって本書は、§1.2 の昇格先列挙を「拡張」として扱い、**最終ドキュメント更新ステップ（§10 ステップ6）で既存規約 §1.2 側にも `domain`（および `lib/unitOfWork`、`server` のコンポジションルート）を昇格先として追記する改訂を同時に行う**。これにより「本書が §1.2 を拡張する」ことを規約本体にも明記し、実装者がこの不一致でミッドストリーム判断を迫られる状態を解消する。

最終ドキュメント更新ステップで、本書への参照および上記 §1.2 拡張を既存規約に追記する（位置は §10 ステップ6 で一意に指定）。本書が補完するのはアーキテクチャ（既存規約 §1）とサーバーサイド実装（既存規約 §6）であり、参照の追記先もこの 2 章とする。

---

## 1. 技術スタック（確定事項・承認後ロック）

| 区分 | 採用技術 | バージョン（package.json 実測） |
| :--- | :--- | :--- |
| フレームワーク | Next.js App Router (Server Actions) | `next@^16.3.6` |
| UI ランタイム | React | `react@19.0.0` |
| 言語 | TypeScript（`strict: true`） | `typescript@5.7.2` |
| DB クライアント | `node:sqlite`（`DatabaseSync`） | Node.js 標準（現行） |
| 将来の DB | Supabase (PostgreSQL) | 未導入（Repository interface で差し替え可能にする） |
| バリデーション | Zod | `zod@^4.6.5` |
| テスト | Vitest + fast-check（プロパティテスト） | `vitest@^3.0.0`, `fast-check@^3.23.1` |
| パスワード | bcryptjs | `bcryptjs@^3.0.3` |
| セッション | jose（JWT） | `jose@^6.2.12` |

追加の DI コンテナ・ORM・クラスデコレータライブラリ（InversifyJS, tsyringe, TypeORM 等）は **導入しない**。DI は手動コンストラクタ注入で行う（§7）。新規ランタイム依存を足さないことをロック条件とする。

TypeScript のクラス実装前提（現行 `tsconfig.json` 実測: `target: "ES2017"`, `strict: true`, `useDefineForClassFields` 未設定）:
- `strict` 配下の `strictPropertyInitialization` が有効なので、エンティティ/VO のフィールドは宣言時初期化・コンストラクタ初期化・`!` 明示のいずれかで初期化漏れを型で検出する。コンストラクタ引数修飾子（`constructor(private readonly db: DatabaseSync)`）を Repository/Service で多用する。
- `target: "ES2017"` のため `useDefineForClassFields` は既定 `false`（定義代入セマンティクスではなく代入セマンティクス）。本設計のクラスは「不変フィールドをコンストラクタで一度だけ設定する」単純な形に限るので、この既定のままで問題は生じない。`target` や当該オプションは**変更しない**（挙動・ビルド設定の非変更＝ビヘイビア保存の一部）。VO の不変性は `readonly` フィールドで表現する。

---

## 2. レイヤリング（責務と境界）

依存方向は既存規約 §1.2 の「上位→下位の一方向依存」を OOP 化後も厳守する。レイヤ依存は次の一方向のみ許可する。

```
app (page.tsx / Server Component)
  │  ← 呼び出しのみ
Server Action ("use server" 薄いアダプタ)
  │
Application Service (ユースケース調整・トランザクション境界)
  │              │
Domain Service   Repository «interface»
  │              ▲
Entity / VO      │ 実装
                 └─ SqliteXxxRepository (infrastructure)
                        │
                     src/lib/db.ts (DatabaseSync)
```

- **ドメイン層（Entity / Value Object / Domain Service）は、下位のインフラ層・`@/lib/db`・`node:sqlite`・Zod・Next.js API を一切 import しない。** 純粋な TypeScript とドメイン型のみに依存する（テスト容易性と DB 差し替えのため）。
- Repository は**インターフェースをドメイン層に置き**、実装をインフラ層に置く（依存性逆転）。
- Application Service はインターフェースにのみ依存し、実装はコンストラクタで受け取る。

### 2.1 Entity（エンティティ）

同一性（`id`）を持ち、ライフサイクルを通じて状態が変化する対象。振る舞い（ドメイン不変条件・計算）を持つ「リッチドメインモデル」とする。貧血ドメインモデル（getter/setter だけの DTO）にしない。

対象（書き込み系・不変条件を持つ内部表現に限る）: `User`, `Tournament`, `Entry`, `EntryMember`, `Waitlist`, `Cancellation`, `Team`。

**重要（エンティティ化の範囲 ＝ 書き込み系の内部表現に限定）**: エンティティ化するのは「永続化され、ドメイン不変条件・計算を宿す書き込み系の内部表現」に限る。**読み取りビュー（クエリ系 Application Service がクライアント境界へ返すためだけに組み立てるフラットな値）はエンティティ化せず、現行どおりプレーンな `interface`（DTO）のまま維持する。** とくに entries の読み取り経路に属する `EntrySummary`（`entries/types/entry.ts`）と、その要素 `EntryMember[]` が示すメンバー表示値は、`getMyEntriesAction` → `MyEntriesResult`（§11 で「不変」と明記する外部契約）として `"use server"` 境界をクライアントへ越える。したがってこれらはクラス化しない（下記「クラス vs DTO の確定」を参照）。

**entries 読み取り経路の「クラス vs DTO」確定（Finding 1 対応）**:
- クラス（エンティティ）にするのは書き込み系の内部表現である `Entry`（確定エントリー）・`EntryMember`（書き込み時のメンバー）・`Waitlist`・`Cancellation` **だけ**。これらは Application Service / Repository 内部でのみ生成・流通し、`"use server"` 境界を越えない。
- DTO（プレーン `interface`）のまま維持するのは `EntrySummary`（および `MyEntriesResult`）。`EntrySummary.members` の要素型は **プレーンな DTO** とし、クラスインスタンスを埋め込まない（採用判断は下記）。
- **採用判断（レビュー推奨案 (a) を基本としつつ名前衝突を解消）**: 現行 `EntryMember` という名前は「書き込み系エンティティ」と「`EntrySummary` が内包するビュー値」の両義で使われていたため一意化する。`EntrySummary.members` の要素型を **新設の読み取り専用 DTO `EntryMemberView`（`entries/types/entry.ts`）** に固定し、現行 `EntryMember`（行ミラーの `interface`）が持つフィールドをそのまま引き継ぐ（名前変更のみでフィールド・形は 1:1、ビヘイビア保存）。一方、書き込み系エンティティ化する `EntryMember` クラスは `entries/domain/EntryMember.ts` に置く。`listSummaries(): EntrySummary[]` はクエリ系が `EntryMemberView[]` を組み立てて返すため、現行の戻り値の形・挙動をそのまま保存できる。

> 補足（名前衝突を避けたくない場合の代替）: `EntryMember` クラスを導入せず、書き込み時のメンバーも `EntryMember`（現行 interface のまま）で扱い、エンティティ化を `Entry` 本体に限定する案も挙動保存上は成立する。ただし本書は「メンバー構成の不変条件（人数レンジ）を `MemberComposition` VO が、確定エントリー生成を `Entry.createConfirmed` が担う」設計（§2.1 責務・§6.2）を採るため、書き込み系メンバーをエンティティ（`EntryMember` クラス）化し、ビュー値を `EntryMemberView` DTO に分離する上記案を**採用する**。

責務の例:
- `Entry.cancel(policy, when)`: キャンセル可否の不変条件（`status === "CONFIRMED"` のみキャンセル可）を自ら検証し、`CancelFeePolicy`（VO）でキャンセル料を算出して `Cancellation` エンティティを生成する。
- `Tournament.canAcceptEntry(confirmedCount)` / `remaining(confirmedCount)` / `capacityStatus(confirmedCount)`: 定員充足状況の派生値算出（現 `capacity.ts` の `calcRemaining` / `calcCapacityStatus` を吸収）。
- `Tournament.isOpen(): boolean`: 受付中判定（`status === "OPEN"`）。現行 actions の `tournament.status !== "OPEN"` 判定を吸収する挙動保存ラッパ。submit の受付期間外チェック（§6.2）はこのメソッドを使う。
- `User.estimateInitialGranLevel()` ではなく、初期レベル算出は後述の VO（`GranLevel`）/ Domain Service へ寄せる（登録時はまだ User が存在しないため。§5 マッピング参照）。

**クライアント境界への DTO 変換ルール（ビヘイビア保存の要）**: `remaining`（`number`）と `capacityStatus`（`"OPEN" | "FEW" | "FULL"`）は、実コードでは `TournamentWithStats`（`tournaments/types/tournament.ts`）および `TournamentCardData`（`tournaments/types/view.ts`）の **プレーンなデータフィールド** であり、クライアント側が値アクセスとして直接参照している。参照元の帰属は次のとおり（実コードで確認済み）: `capacityStatus` はフィルタフック `tournaments/hooks/useTournamentFilters.ts`（`t.capacityStatus` を OPEN/FEW/WAITLIST 判定に使用）が参照し、`remaining` は表示コンポーネント `tournaments/components/{ScheduleCards.tsx, ScheduleTable.tsx, GuidelinesViewer.tsx}`（`t.remaining` を子コンポーネントへ props 透過）が参照する。したがって、たとえ `Tournament` エンティティがこれらをメソッド／派生値として持っても、**Server Action・ビューの戻り値は現行どおり `TournamentWithStats` / `TournamentCardData` のプレーンオブジェクト（`remaining: number`, `capacityStatus: "OPEN"|"FEW"|"FULL"` を含む）を維持する**。エンティティ → DTO への変換はアダプタ層（§2.6）またはクエリ系 Application Service が明示的に行い、**クラスインスタンスやメソッドを `"use server"` 境界・Client Component へ渡さない**（`"use server"` 境界を越えるとメソッドは失われ、関数呼び出し形にしていたクライアントが壊れる）。§11 チェックリストにこの不変条件を明記する。

**entries 読み取り経路に対する DTO 規約（1 文確定・Finding 1）**: entries 側で `"use server"` 境界を越える読み取り戻り値 `EntrySummary` / `MyEntriesResult` は**プレーンな DTO であり、その内包要素 `EntrySummary.members` は読み取り専用 DTO `EntryMemberView[]`（クラスではない）とする**。クラス（エンティティ）化するのは書き込み系の `Entry` / `EntryMember`（`entries/domain/`）・`Waitlist` / `Cancellation` に限り、これらは境界を越えない（詳細は §2.1 冒頭「クラス vs DTO の確定」）。tournaments 側の `remaining` / `capacityStatus` と同じく、entries 側もこの経路で**クラスインスタンスを境界越えさせない**。

**不変条件（invariant）の所有**: 「エンティティ単体で閉じる不変条件」はエンティティが所有する。例: `gran_level` が 100〜999（`GranLevel` VO）、`Entry` のキャンセル可否ステータス。「複数レコード・集合にまたがる不変条件」（定員排他、キュー採番の一意性、重複エントリー防止）は Application Service がトランザクション内で所有する（§6）。DB の CHECK / UNIQUE 制約は最後の防衛線として維持し、二重化する（アプリ層で先に弾くが、DB 制約も残す）。

### 2.2 Value Object（値オブジェクト）

同一性を持たず、値そのものが等価性を決める不変（immutable）オブジェクト。`readonly` フィールドとし、生成時にバリデーションする。等価比較が必要なら `equals(other)` を実装する。

対象:
- `GranLevel`: 100〜999 の整数レート。範囲外はコンストラクタで拒否（丸めるのではなく、丸め責務は生成側 Domain Service に置く。§5）。`toTier()` / `toClassLabel()`（現 `classLabel.ts` を吸収）。
- `CancelFeePolicy`: 開催日までの残日数から料率（0/50/100）・請求額・有償フラグ・初期管理ステータスを決める方策オブジェクト（現 `cancelFee.ts` を吸収）。`calculate(eventDate, entryFee, when)` を持つ。
- `CapacityStatus`（`"OPEN" | "FEW" | "FULL"`）と残枠算出: `Tournament` エンティティのメソッド（`remaining(confirmedCount)` / `capacityStatus(confirmedCount)`）として表現する。これらはドメイン内の算出手段にすぎず、§2.1 のとおり境界を越えるときはプレーンフィールドへ戻す。
- `MemberComposition`: 種目区分とメンバー配列の妥当性（人数レンジ）を検証する VO（現 `category.ts` の `memberCountRange`/`requiresLeader`/`requiresTeam` を吸収）。

### 2.3 Domain Service（ドメインサービス）

単一のエンティティ／VO に自然に属さないドメインロジック、または複数エンティティにまたがる計算を担うステートレスなクラス。DB アクセスはしない（Repository を直接触らない。必要な入力は Application Service が集めて渡す）。

対象:
- `RankingService`: ユーザー集合の安定順序整列・同率同順位付与（現 `ranking.ts`）、チームランキング整列（現 `dataViewData.ts` の `buildTeamRanking`）。
- `LevelDistributionService`: レベル分布集計（現 `distribution.ts`）。
- `EntryHistoryService`: 出場履歴のソート・フィルタ（現 `entryHistory.ts`）。
- `GranLevelAssignmentService`: 申告階級 → 暫定初期レベル算出（現 `level.ts` の `estimateInitialGranLevel`、丸め込みを含む）。
- `PeriodFilterService`: 期間フィルタ下限算出（現 `period.ts`）。
- `TeamRatingService`: チーム平均レート算出（現 `teamRating.ts`）。

これらは純粋計算なので、現行の純粋関数テストをほぼそのまま移植できる（メソッドをインスタンス経由で呼ぶだけ）。

### 2.4 Repository（インターフェース + 実装）

永続化の抽象。**インターフェースをドメイン層に、実装をインフラ層に置く。** ドメイン型（Entity / VO）を入出力とし、DB 行型（`XxxRow`）やSQLはインフラ実装の内部に完全に隠蔽する（既存規約 §6「SQL はこの層にのみ閉じ込める」を継続）。

**Repository の入出力ドメイン型とリハイドレーション（Finding 2 確定）**: Repository の**書き込み系メソッドが受け取る／参照系の単一・複数エンティティ取得が返すドメイン型はエンティティクラスである**（`findById(entryId): Entry | null` の `Entry` はエンティティクラス、`insertConfirmed(entry: Entry, ...)` はエンティティを受け取る）。**行 → エンティティ変換（rehydrate）は各 `SqliteXxxRepository` の private ファクトリ**（例: `private toEntry(row: EntryRow): Entry` / `toEntryMember` / `toWaitlist` / `toCancellation`）が担い、現行 `entryRepository.ts` の `toEntry` / `toEntryMember` / `toWaitlist` / `toCancellation` 相当の変換ロジックを **1:1 で移植**する（SQL と行型はこのクラス内に隠蔽）。ただし **読み取りビュー（`listSummaries` が返す `EntrySummary`）はエンティティではなくプレーン DTO** であり（§2.1・Finding 1）、その内包メンバーは `EntryMemberView` DTO とする。したがって下記 interface では、エンティティを返すメソッドと DTO を返すメソッドを明示的に区別する。

**ドメイン層 interface の import 方針（Finding 3 確定）**: §2 の「ドメイン層は db / Zod / Next.js を import しない」という禁止は、**インフラ実装・`@/lib/db`・`node:sqlite`・Zod・Next.js API に対してのみ**適用される。**純粋な型定義モジュール `features/<f>/types/`（Zod スキーマを含まない型リテラル部分）は、ドメイン層・Repository interface から import してよい。** したがって `EntryStatus`・`EntrySummary`・`EntryMemberView`・`ListSummaryParams` など `entries/types/entry.ts` の型は interface/ドメイン層から参照可能である（これらは DB にも Zod にも依存しない純粋な TypeScript 型であるため）。なお `entries/types/schema.ts`（Zod スキーマ）はドメイン層から import してはならない（検証はアダプタ層が担う）。

**`ListSummaryParams` の定義・配置（Finding 3 確定）**: 現行 `listEntrySummaries` の引数はインラインオブジェクト型（`{ userId: string; scope: "personal" }` ないし `{ userId: string; teamId: string; scope: "team" }`）である。これを名前付き型 **`ListSummaryParams = { userId: string; teamId?: string | null; scope: "personal" | "team" }`** として `entries/types/entry.ts` に新設し、現行インライン型を 1:1 で置き換える（`teamId` は personal スコープでは省略＝現行と同一の呼び出し形）。interface はこの名前付き型を参照する。

**インターフェースは「例」ではなく、現行 `entryRepository.ts` の全公開関数を漏れなく写像したものとする。** §5 の完全対応表（entries 詳細行）に全 11 関数の写像を記載する。`createConfirmedEntry` / `createWaitlist` / `cancelEntry` / `replaceEntryMembers` が内部で張っていたトランザクション（`BEGIN IMMEDIATE`）は Application Service の UoW（§6）へ移し、Repository はトランザクションを張らない単一操作に分解する。その過程で、現行 `createConfirmedEntry` にインラインされていた確定数 `SELECT COUNT(*)` を **新設メソッド `countConfirmed(tournamentId)`** として切り出す（現行に同名関数は無い＝新規導入である点を明記）。同様に `createWaitlist` のキュー採番（`MAX(queue_number)+1`）は **新設 `nextQueueNumber(tournamentId)`** として切り出す。

**Waitlist 系メソッドの所属（設計判断）**: `waitlists` テーブルは `entries` と同じユースケース（キャンセル待ち登録・一覧・繰り上がり）で常に一体運用され、`listSummaries` も entries と waitlists を 1 クエリ群でマージして返す。別リポジトリに切るとこのマージ処理が跨リポジトリ結合になり UoW 境界も曖昧になるため、**waitlist 系は独立した `WaitlistRepository` を作らず、`EntryRepository`（entries ドメイン）に同居させる**。

```typescript
// src/features/entries/domain/EntryRepository.ts
export interface EntryRepository {
  // --- 参照系（現行をそのまま写像） ---
  findById(entryId: string): Entry | null;                       // ← findEntryById
  hasActiveEntry(tournamentId: string, userId: string, teamId: string | null): boolean; // ← 同名
  findSameDayActiveEntryTitles(                                  // ← findSameDayActiveEntries
    eventDate: string, userId: string, teamId: string | null, excludeTournamentId: string,
  ): string[];
  listMembers(entryId: string): EntryMemberView[];               // ← listEntryMembers（読み取りビュー＝DTO を返す。EntrySummary 組み立て等に使う）
  listSummaries(params: ListSummaryParams): EntrySummary[];      // ← listEntrySummaries（entries+waitlists マージ。戻り値は DTO。members は EntryMemberView[]）
  listInvolvedTournamentIds(params: { userId: string; teamId: string | null }): Set<string>; // ← 同名
  countConfirmed(tournamentId: string): number;                 // ★新設（確定数 COUNT。現行はインライン）
  countActiveWaitlist(tournamentId: string): number;            // ← 同名
  // --- 確定エントリー（UoW 内で呼ばれる単一操作へ分解） ---
  insertConfirmed(entry: Entry, members: EntryMember[]): void;   // ← createConfirmedEntry の INSERT 部（Entry/EntryMember は書き込み系エンティティ）
  updateStatus(entryId: string, status: EntryStatus): void;      // ← cancelEntry の UPDATE 部
  replaceMembers(entryId: string, members: EntryMember[]): void; // ← replaceEntryMembers（DELETE+INSERT+updated_at）
  insertCancellation(cancellation: Cancellation): void;          // ← cancelEntry の cancellations INSERT 部
  // --- キャンセル待ち（同居） ---
  hasActiveWaitlist(tournamentId: string, userId: string, teamId: string | null): boolean; // ← createWaitlist の重複判定部
  nextQueueNumber(tournamentId: string): number;                 // ★新設（MAX(queue_number)+1。現行はインライン）
  insertWaitlist(waitlist: Waitlist): void;                      // ← createWaitlist の INSERT 部
}
```

実装:
```typescript
// src/features/entries/infrastructure/SqliteEntryRepository.ts
export class SqliteEntryRepository implements EntryRepository {
  constructor(private readonly db: DatabaseSync) {}
  // toEntry / toEntryMember / toWaitlist / toCancellation（行→エンティティ）は private メソッドで
  // 現行 entryRepository.ts の変換ロジックを 1:1 移植。
  // listMembers / listSummaries の DTO 組み立て（行→ EntryMemberView / EntrySummary）も private 変換で行う。
}
```

**エンティティ返却 vs DTO 返却の一意化（Finding 1・2 の整合）**: 上記 interface で、`findById` は**エンティティ `Entry`** を返す（書き込み・不変条件に使うため）。`listMembers` は**読み取りビュー DTO `EntryMemberView[]`** を返す（`EntrySummary` 組み立てや表示用で、不変条件を持たないため）。`insertConfirmed` が受け取る `members: EntryMember[]` は書き込み系エンティティである。これにより「同じ `EntryMember` 名がエンティティと DTO の両義を持つ」曖昧さを解消する（エンティティ＝ `EntryMember` クラス、ビュー値＝ `EntryMemberView` DTO）。`listSummaries` はエンティティを一切返さないため、DTO 化の追加経路は不要である。

**設計判断（トランザクションとRepositoryの関係）**: 現行は Repository 関数の内部で `BEGIN IMMEDIATE` していた。OOP 化後は、個々の Repository メソッドはトランザクションを**開始しない**（単一の `INSERT`/`UPDATE`/`SELECT` に責務を限定）。複数操作をまたぐ原子性は Application Service が Unit of Work（§6）で束ねる。これにより「定員チェック → 挿入」のような複合処理を Application Service 側で明示的なトランザクション境界として表現でき、Repository は再利用可能な単位になる。

### 2.5 Application Service（アプリケーションサービス）

1ユースケース＝1メソッドを原則とする。認証・入力検証の後段（ドメイン前提条件の確認）、Repository 呼び出しの調整、トランザクション境界の管理、Domain Service の呼び出し、通知ログ記録を調整する。Entity/VO に振る舞いを委譲し、自身はオーケストレーションに徹する（手続きを抱え込みすぎない）。

Application Service の責務（duty）リスト:
- 認証後の入力検証後段（ドメイン前提条件の確認）。
- **権限判定をドメイン事前条件として扱う（本人 / チーム代表 / 管理者、代表者限定カテゴリ）。** submit / submitWaitlist / cancel / updateMembers の 4 ユースケースすべてで、注入された `TeamRepository`（必要に応じて `UserRepository`）を使って owner / team-leader / admin を判定する。現行アダプタの権限判定ロジックは文言・分岐をそのまま維持したまま Application Service へ移設する（ビヘイビア保存。アダプタ層は権限判定を持たない。§2.6）。
- Repository 呼び出しの調整とトランザクション境界（UoW）の管理。
- Domain Service の呼び出し。
- 通知ログ記録のオーケストレーション。

対象: `EntryApplicationService`（submit / bulkSubmit / waitlist / cancel / updateMembers / listMyEntries）、`AuthApplicationService`（register / login / logout）、`DataViewService`（現 `dataViewData.ts` を class 化）、`TournamentQueryService` 等。

Application Service は `"use server"` を持たない純 TypeScript クラスとする。`"use server"` は Server Action アダプタ（§2.6）のみが持つ。これによりテストから直接 new してユニット/統合テストできる。

**`submit` の戻り値型 `SubmitOutcome`（判別可能ユニオン）**: submit は「確定成功」と「事前満員（例外化しない早期復帰）」の 2 結果を返す。事前満員（§6.2 (3)）は正常系の分岐であり例外にしないため、戻り値を判別可能ユニオンで表現する（`entries/application/EntryApplicationService.ts` に定義）。

```typescript
export type SubmitOutcome =
  | { kind: "confirmed"; entry: Entry } // 確定成功。アダプタは成功 EntryActionResult を返す。
  | { kind: "preFull" };                // 事前満員。アダプタが「この大会は満員です。キャンセル待ちへご登録ください。」へ文言化。
```

アダプタ層（§2.6）は `outcome.kind` で分岐し、`"preFull"` を §4.2 (a) の事前満員文言へマップする。本文中の `SubmitOutcome.preFull()` / `SubmitOutcome.confirmed(entry)` は、それぞれ `{ kind: "preFull" }` / `{ kind: "confirmed", entry }` を生成するファクトリ関数の略記である（実装は単純なオブジェクトリテラル返却でよい）。`TournamentQueryService` 等、本書で名のみ登場し責務未定義のクエリ系サービスは横展開フェーズで各 feature 着手時に定義する。

### 2.6 Server Action（薄いアダプタ）

`"use server"` ファイル（`actions.ts`）は、現行の外部契約（関数シグネチャ・戻り値型 `EntryActionResult` / `AuthActionState` 等）を**そのまま維持**する薄いアダプタに縮退させる。責務は次に限定する。

1. セッション取得・Zod 入力検証（既存どおり早期リターン）。
2. コンポジションルート（§7）から Application Service を組み立てる。
3. Application Service を呼び、ドメイン例外 / Result を既存のユーザー向けメッセージ（`EntryActionResult` 等）へマッピングする。
4. `revalidatePath` 等の Next.js 固有処理。

アダプタの責務はこの 4 点（セッション取得 + Zod 検証 + コンポジションルートからの配線 + 例外→Result 変換（`toActionResult`）+ revalidate）に限定する。**権限判定（本人 / チーム代表 / 管理者の判定、User/Team の取得と比較）はアダプタ層の責務ではなく、Application Service がドメイン事前条件として担う（§2.5・§6.2.2）。**

Server Action の名前・引数・戻り値の形は 1 バイトも変えない（ビヘイビア保存）。

---

## 3. ディレクトリ配置規約

既存の feature-based 構成（`src/features/<f>/{components,hooks,server,types,utils}`）を維持しつつ、各 feature 内にバックエンド 3 層のサブディレクトリを追加する。ディレクトリ名は既存規約 §2 の `kebab-case`… ではなく、既存の `server`/`types`/`utils` と同じく小文字単語（`domain`/`application`/`infrastructure`）とする（既存ディレクトリ命名の実態に合わせる）。

```
src/features/<f>/
├── domain/                     # ドメイン層（DB・Next.js 非依存）
│   ├── <Entity>.ts             # エンティティクラス（例: Entry.ts）
│   ├── <ValueObject>.ts        # 値オブジェクト（例: CancelFeePolicy.ts, GranLevel.ts）
│   ├── <DomainService>.ts      # ドメインサービス（例: RankingService.ts）
│   └── <Entity>Repository.ts   # リポジトリ interface（例: EntryRepository.ts）
├── application/                # アプリケーションサービス（ユースケース）
│   └── <F>ApplicationService.ts
├── infrastructure/             # リポジトリ実装（SQL をここに隔離）
│   └── Sqlite<Entity>Repository.ts
├── server/                     # Server Actions（"use server" 薄いアダプタ）+ 既存 server コード
│   └── actions.ts
├── types/                      # 型定義・Zod スキーマ（現状維持）
├── components/ hooks/          # フロント（本リファクタリングの主対象外）
└── utils/                      # 純粋関数の残置場所（§5 で domain へ移設後は原則空/撤去）
```

横断的に共有されるドメイン基盤（複数 feature が使う基底クラス・共通例外・Unit of Work・コンポジションルート）はルート直下へ置く。これは既存規約 §1.2 の「共有はルートへ昇格」の方針を踏襲しつつ、§1.2 の昇格先列挙（`components`/`types`/`utils`）を `domain`・`lib/unitOfWork`・`server`（コンポジションルート）へ**拡張**するものである（前文のとおり、§10 ステップ6 で規約 §1.2 側にも同拡張を追記して整合させる。本書単独の「準拠」主張ではない）。

```
src/
├── lib/
│   ├── db.ts                   # DatabaseSync シングルトン（変更しない）
│   └── unitOfWork.ts           # SqliteUnitOfWork（§6）
├── domain/                     # 全 feature 共通のドメイン基盤
│   ├── Entity.ts               # 任意: 共通基底（id 比較の equals 等）
│   └── errors.ts               # DomainError 階層（§4）
└── server/
    └── container.ts            # コンポジションルート（手動 DI / §7）
```

既存の `server/` 配下にあるビューモデル組み立て（`dataViewData.ts`, `entryViewData.ts`, `currentUser.ts`, `tournamentResultsGuard.ts`）は、クエリ中心なら `application/` のサービス（例: `DataViewService`）へ、純粋整形なら `domain/` の Domain Service へ振り分ける（§5 マッピング）。

---

## 4. エラー表現方針（例外 vs Result 型の統一）

現状は混在している: Repository は `{ ok: false, reason: "FULL" | "DUPLICATE" }` の Result 型、致命的 DB エラーは `throw` を actions 側の `try/catch` で握り潰して汎用メッセージ化、Server Action は `EntryActionResult`/`AuthActionState` という独自 Result 型を返す。これを次の 3 層ルールに統一する。

**統一方針: 「予期されるドメイン結果」は型付き例外（DomainError サブクラス）で表現し、Server Action アダプタ層で Result 型へ変換する。** 「予期しない技術的失敗（DB 例外等）」は握らず上位へ伝播させ、アダプタ層で汎用メッセージへマッピングする。理由: Result 型をドメイン/アプリ層まで貫くと、`reason` 文字列が各層で増殖し型の集約が崩れる。OOP ではドメインの失敗を例外クラスの型階層で表現する方が、呼び出し側の分岐が型安全かつ集約的になる。一方、Server Action の外部契約（`EntryActionResult` 等の Result 戻り値）は**契約として維持**するため、変換はアダプタ層に閉じる。

### 4.1 ドメイン例外階層（`src/domain/errors.ts`）

```typescript
export abstract class DomainError extends Error {
  abstract readonly code: string; // 例: "ENTRY_FULL"
}
export class EntryFullError extends DomainError { readonly code = "ENTRY_FULL"; }
export class DuplicateEntryError extends DomainError { readonly code = "DUPLICATE_ENTRY"; }
export class DuplicateWaitlistError extends DomainError { readonly code = "DUPLICATE_WAITLIST"; }
export class EntryNotCancellableError extends DomainError { readonly code = "NOT_CANCELLABLE"; }
export class TournamentNotOpenError extends DomainError { readonly code = "TOURNAMENT_NOT_OPEN"; }
// 権限エラーは操作別・種目別に異なるユーザー文言を持つため、messageKey で文脈を保持する。
// messageKey → 文言の対応は §4.2 の権限メッセージ表（アダプタ層の toActionResult）が正とする。
export type PermissionContext =
  | "cancel"          // キャンセル権限
  | "updateMembers"   // メンバー変更権限
  | "leaderOnlySubmit"// 代表者のみ申込可（種目要件）
  | "leaderOnlyWaitlist" // 代表者のみ申込可（キャンセル待ち・短縮文言）
  | "teamOwnership";  // 自身が代表のチームでのみ申込可
export class PermissionDeniedError extends DomainError {
  readonly code = "PERMISSION_DENIED";
  constructor(readonly context: PermissionContext) { super(); }
}
export class NotFoundError extends DomainError { readonly code = "NOT_FOUND"; }
export class MemberCompositionError extends DomainError { readonly code = "INVALID_MEMBERS"; }
export class ConflictConfirmationRequiredError extends DomainError {
  readonly code = "CONFLICT_CONFIRM";
  constructor(readonly conflictTournaments: string[]) { super(); }
}
```

### 4.2 層ごとのエラー規約（各失敗操作の具体仕様）

ユーザー向け文言の**正（source of truth）は、アダプタ層の純関数 `toActionResult(error, context?)` のマッピング表**とする（下の 2 表）。文言は実コード（`entries/server/actions.ts`）と **1 バイト一致**で保存する（§11 がこれを要求する）。本節の表の文言は実コードから転記したものであり、要約・言い換えしてはならない。

**(a) ドメイン例外 → ユーザー文言（submit / waitlist / cancel / updateMembers 共通の非権限系）**

| 操作・失敗条件 | 可復旧/致命 | 投げるもの | `toActionResult` が返す文言（実コードと 1 バイト一致） | ログ |
| :--- | :--- | :--- | :--- | :--- |
| `Entry.cancel`: `status !== "CONFIRMED"` | 可復旧 | `EntryNotCancellableError` | `このエントリーはキャンセルできません。` | しない |
| submit 事前満員（UoW 外）: `tournament.remaining(confirmed) <= 0` | 可復旧 | 例外化せず `SubmitOutcome`（`{ kind: "preFull" }`）を返す。アダプタ層が `outcome.kind === "preFull"` を文言化 | `この大会は満員です。キャンセル待ちへご登録ください。` | しない |
| submit UoW 内 定員 TOCTOU: 確定数 ≥ capacity | 可復旧 | `EntryFullError` | `直前に満員となりました。キャンセル待ちへご登録ください。` | しない |
| submit 重複（UoW 内 再チェック含む） | 可復旧 | `DuplicateEntryError` | `この大会には既にエントリー済みです。` | しない |
| submit 同日重複（未承認）: 同日エントリー有 かつ `!acknowledgeConflict` | 可復旧 | `ConflictConfirmationRequiredError`（`conflictTournaments` 保持） | `needsConfirm:true` + `conflictTournaments` + 文言 `同日に既にエントリー中の大会があります。重複参加にならないかご確認ください。` | しない |
| submit 受付期間外: `tournament.status !== "OPEN"` | 可復旧 | `TournamentNotOpenError` | `この大会は現在エントリーを受け付けていません。` | しない |
| waitlist 重複: 既に WAITING/OFFERED | 可復旧 | `DuplicateWaitlistError` | `既にキャンセル待ちに登録済みです。` | しない |
| `GranLevel` 生成: 100〜999 範囲外 | プログラミング誤り（致命） | `RangeError`（`DomainError` 外） | 伝播 → アダプタ `catch` の汎用文言 | error ログ |
| 各 Repository `insert/update` の SQLite 例外 | 致命 | SQLite 例外をそのまま伝播 | 操作別の汎用 `catch` 文言（下記） | error ログ（内部のみ） |
| Unit of Work commit 失敗 | 致命 | 例外伝播（自動 ROLLBACK 後） | 同上 | error ログ |

操作別の汎用 `catch` 文言（致命時）: submit=`エントリー処理でエラーが発生しました。時間をおいてお試しください。` / waitlist=`処理でエラーが発生しました。` / cancel=`キャンセル処理でエラーが発生しました。` / updateMembers=`メンバー更新でエラーが発生しました。`。

**(b) 権限エラー → ユーザー文言（`PermissionDeniedError.context` ごとに全列挙）**

単一の `PermissionDeniedError` ではメッセージを復元できないため、`context`（§4.1 の `PermissionContext`）で分岐する。アダプタ層が `context` → 固定文言を返す。現行の全権限文言を漏れなく列挙する:

| `context` | 発生箇所 | 文言（実コードと 1 バイト一致） |
| :--- | :--- | :--- |
| `leaderOnlySubmit` | submit: 代表者要件種目で `role !== "LEADER"` かつ `!isAdmin` | `この種目は代表者のみ申込できます。チームの代表者にご依頼ください。` |
| `leaderOnlyWaitlist` | waitlist: `requiresTeam(category)` が真のブロック**内側**で `requiresLeader && role !== "LEADER" && !isAdmin`（短縮文言）。**`requiresTeam` 内のネスト。SINGLES では到達しない** | `この種目は代表者のみ申込できます。` |
| `teamOwnership` | submit/waitlist: `team.leaderUserId !== user.id` かつ `!isAdmin` | `ご自身が代表を務めるチームでのみ申込できます。` |
| `cancel` | cancel: 本人でもチーム代表でも管理者でもない | `このエントリーをキャンセルする権限がありません。` |
| `updateMembers` | updateMembers: 同上 | `メンバーを変更する権限がありません。` |

注: `teamOwnership` と `leaderOnlySubmit`/`leaderOnlyWaitlist` は現行コードで別チェック・別文言である（権限と種目要件の二段）。両者を 1 文言へ潰さない。また「申込チームを指定してください。」「チームが見つかりません。」「出場メンバーは N〜M 名で…」「メンバー変更は開催3日前までです。期限を過ぎています。」等の **入力検証・前提エラー**は権限例外ではなくアダプタ層（§2.6）で現行どおり早期 return する（ドメイン例外にしない）。文言は実コードと一致させる。

**安全なエラーメッセージ**（既存規約 §7.2）を維持する。`DomainError`（+ `context`）→ ユーザー文言の対応はアダプタ層の純関数 `toActionResult` に集約し、DB エラー・スタックトレースはクライアントへ出さない。ログイン失敗はユーザー列挙防止のため従来どおり存在有無を区別しない汎用文言（`AuthApplicationService` は成功/失敗のみを返し、理由を漏らさない）。

### 4.3 「見つからない」の扱い

`findById` 系 Repository メソッドは従来どおり `null` を返す（例外にしない）。Application Service が `null` を検知して `NotFoundError` に変換するか、文脈に応じたメッセージへマッピングする。これは現行 actions の `if (!entry) return {...}` の挙動を保存する。

---

## 5. 既存 utils / server ロジックの移設マッピング（ファイル単位）

ビヘイビア保存のため、各純粋関数の入出力・境界条件は変えずにクラスのメソッドへ移す。既存テストは移設先のメソッド呼び出しに書き換えるだけで通ることを移設の受け入れ条件とする。

| 現行ファイル | 現行シンボル | 移設先レイヤ | 移設先（新）シンボル |
| :--- | :--- | :--- | :--- |
| `features/entries/utils/cancelFee.ts` | `calculateCancelFee`, `CancelFeeResult` | VO | `entries/domain/CancelFeePolicy.ts` → `CancelFeePolicy.calculate(eventDate, entryFee, when?)`。**日数差は現行 `cancelFee.ts` の `Math.round(diffMs / 86400000)`（当日0起点）を厳密に保存する。既存規約 §5.1 サンプルの `Math.ceil` は採用せず、ビヘイビア保存のため実装を正とする。** 境界（≥8→0%, ≥3→50%, それ未満→100%）と `feeAmount`（50%は `Math.floor(fee*0.5)`）も不変。 |
| `features/auth/utils/level.ts` | `estimateInitialGranLevel`, `CLASS_RANGE`（非公開） | Domain Service | `auth/domain/GranLevelAssignmentService.ts`。**中央値算出レンジ（現 `CLASS_RANGE`、一部オーバーラップ）は `GranLevel.toTier()` の判定境界とは別定義のまま保存する（統一禁止。実コードにも「階級判定には使用しないこと」と明記あり）。** 丸め `Math.max(100, Math.min(999, Math.round((min+max)/2)))` は本サービス側で行い、丸めた値で `GranLevel` を生成する。 |
| `features/auth/utils/classLabel.ts` | `granLevelToTier`, `granLevelToClassLabel` | VO | `auth/domain/GranLevel.ts` → `GranLevel.toTier()` / `toClassLabel()`（後方互換の薄い関数ラッパを当面残置可） |
| `features/tournaments/utils/capacity.ts` | `calcRemaining`, `calcCapacityStatus`, `CapacityStatus` | Entity メソッド | `Tournament.remaining` / `Tournament.capacityStatus()`（VO `Capacity` に抽出も可） |
| `features/tournaments/utils/category.ts` | `isTeamCategory`, `requiresLeader`, `requiresTeam`, `memberCountRange` | VO/Domain Service | **関数単位で確定**: `isTeamCategory` / `requiresLeader` / `requiresTeam` → `tournaments/domain/CategoryRules.ts`（種目区分の静的ルール判定。VO 相当のルール集。`requiresLeader = isTeamCategory || DOUBLES`、`requiresTeam = requiresLeader` の内部依存を保存）。`memberCountRange` → `MemberComposition` VO の人数レンジ検証（`CategoryRules` を内部利用。`SINGLES=1〜1 / DOUBLES=2〜2 / 団体戦=teamSizeMin??4〜teamSizeMax??6` の既定を保存）。entries パイロットは `requiresLeader`/`requiresTeam`/`memberCountRange`（+ `isTeamCategory`）を使うため、この写像をパイロット着手前に確定済みとする。 |
| `features/data/utils/ranking.ts` | `rankUsers` | Domain Service | `data/domain/RankingService.ts` → `rankUsers()` |
| `features/data/utils/teamRating.ts` | `computeTeamRating` | Domain Service | `data/domain/TeamRatingService.ts` → `computeTeamRating()` |
| `features/data/utils/distribution.ts` | `buildDistribution` | Domain Service | `data/domain/LevelDistributionService.ts` → `buildDistribution()` |
| `features/data/utils/entryHistory.ts` | `sortEntries`, `filterEntries` | Domain Service | `data/domain/EntryHistoryService.ts` |
| `features/data/utils/period.ts` | `periodLowerBound` | Domain Service | `data/domain/PeriodFilterService.ts` |
| `features/data/server/dataViewData.ts` | `buildDataViewData`（公開 export 関数）, `DataViewData`（公開 export 型）／内部ヘルパ `buildTeamRanking`・`buildSelfRankSummary`（非公開） | Application Service | `data/application/DataViewService.ts`。**公開するランタイムシンボル（メソッド）は `buildDataViewData` 相当の 1 メソッドのみ。** 戻り値の型 `DataViewData`（interface）は現行も `export` されており、`data/application/DataViewService.ts`（または `data/types/`）へ移して **引き続き公開する**（Server Action 戻り値型として §11 の外部契約に含まれるため）。内部ヘルパ `buildTeamRanking` は `RankingService`（チーム整列）へ、`buildSelfRankSummary` は同サービスの private メソッドへ吸収（外部公開ランタイム API を増やさない） |
| `features/auth/server/currentUser.ts` | `getCurrentUser`, `toCurrentUser` | Application Service | `auth/application/CurrentUserService.ts`（`toCurrentUser` は `GranLevel.toClassLabel()` を利用） |
| `features/entries/server/entryViewData.ts` | ビュー組み立て | Application Service | `entries/application/EntryViewService.ts` |
| `features/data/server/tournamentResultsGuard.ts` | フォールバック判定 | Infrastructure | `SqliteDataRepository` 内の private、または専用ガード |
| `features/entries/server/entryRepository.ts`（全公開関数の完全対応） | `hasActiveEntry`, `findSameDayActiveEntries`, `listEntryMembers`, `findEntryById`, `listEntrySummaries`, `createConfirmedEntry`, `createWaitlist`, `listInvolvedTournamentIds`, `countActiveWaitlist`, `cancelEntry`, `replaceEntryMembers` | Infrastructure + Application Service | `hasActiveEntry`→同名 / `findSameDayActiveEntries`→`findSameDayActiveEntryTitles` / `listEntryMembers`→`listMembers` / `findEntryById`→`findById` / `listEntrySummaries`→`listSummaries` / `listInvolvedTournamentIds`→同名 / `countActiveWaitlist`→同名。トランザクション付き関数は AppService(UoW)+Repository 単一操作へ分解: `createConfirmedEntry`→`EntryApplicationService.submit` + `countConfirmed`(★新設)/`insertConfirmed` / `createWaitlist`→`submitWaitlist` + `hasActiveWaitlist`/`nextQueueNumber`(★新設)/`insertWaitlist` / `cancelEntry`→`cancel` + `updateStatus`/`insertCancellation` / `replaceEntryMembers`→`replaceMembers`。waitlist 系は `EntryRepository` に同居（§2.4）。**補助型 4 種の移設（Finding 5）**: `entryRepository.ts` が同時に export する `CreateEntryResult`/`WaitlistResult`（`{ok:false;reason}` Result 型）は §4 の例外方針へ移行し**廃止**（ドメインは例外、アダプタが Result へ変換）。`CreateEntryParams` → `SubmitEntryCommand`（`entries/application/`、`submit` の入力コマンド）。`CancelEntryParams` → `cancel` メソッド引数へ内部化（`CancelFeePolicy.calculate` の算出値を内部で渡すため独立型は不要）。これら 4 型が feature 外から import されていないことを着手時に grep 確認してから削除する（import されていれば削除は契約変更になるため） |
| `features/entries/types/entry.ts` | （新設）`ListSummaryParams`、`EntryMemberView` | 型定義 | `ListSummaryParams = { userId; teamId?; scope }`（現行インライン型の名前付き化・§2.4）、`EntryMemberView`（`EntrySummary.members` 用の読み取り DTO。現行 `EntryMember` interface のフィールドを 1:1 継承・§2.1）。書き込み系 `EntryMember` はエンティティ化し `entries/domain/EntryMember.ts` へ |
| 各 `server/xxxRepository.ts`（auth/tournaments/teams/data/notifications） | `toXxx` 変換 + SQL 関数群 | Infrastructure | `Sqlite<Entity>Repository` の実装内（private 行変換）。公開関数は entries と同様に「参照系は同名/リネーム写像、トランザクション系は AppService(UoW)+単一操作へ分解」の方針で 1:1 対応表を各 feature 着手時に作成する |
| 各 `server/actions.ts` | Server Action 群 | Server アダプタ | 薄いアダプタに縮退（契約維持） |

**重要な相互依存の保存（2 つのレンジ定義を混同しない）**: `classLabel.ts`（`granLevelToTier`）の 8 段階境界は**下限値による連続判定**（850/750/650/550/450/350/250/それ未満）であり、`dataViewData.ts` 経由で `ranking`/`distribution`/`selfRankSummary` が使う **階級判定の単一の真実の源**である。移設後は `GranLevel.toTier()` がこれを担い、`RankingService` / `LevelDistributionService` はこれを使う（境界の二重定義を作らない）。

一方 `level.ts` の `CLASS_RANGE`（登録時の**中央値算出専用**レンジ、一部オーバーラップ）は **`toTier()` の判定境界とは別物**であり、`GranLevelAssignmentService` は `toTier()` 境界を使ってはならない（実コードに「階級判定には使用しないこと」と明記）。この「算出用レンジと判定用境界は別定義のまま保存する（統一禁止）」を厳守する。

丸め責務の明確化: 現行 `estimateInitialGranLevel` は `Math.max(100, Math.min(999, Math.round((min+max)/2)))` で丸めている。`GranLevel` VO は範囲外を**拒否**する設計なので、丸めは `GranLevelAssignmentService`（算出用レンジ側）が行い、丸めた値で `GranLevel` を生成する。これで現行の「登録時は必ず 100〜999 に収まる」挙動を保存する。

---

## 6. トランザクション境界 / Unit of Work

現行は Repository 関数内で `db.exec("BEGIN IMMEDIATE")` → 処理 → `COMMIT` / `catch` で `ROLLBACK` している。OOP ではトランザクション境界を **Application Service** が持ち、`node:sqlite` の原子性を **Unit of Work** でラップする。

### 6.1 SqliteUnitOfWork（`src/lib/unitOfWork.ts`）

```typescript
export class SqliteUnitOfWork {
  constructor(private readonly db: DatabaseSync) {}

  // BEGIN IMMEDIATE → work() → COMMIT。例外時は ROLLBACK して再 throw。
  run<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}
```

`node:sqlite` の `DatabaseSync` は同期 API なので、`work` は同期関数とする（現行実装と同じ前提）。ネストした `run` は行わない（SQLite は入れ子トランザクション非対応 / 現行も非ネスト）。1 ユースケース = 1 `run` を原則とする。

### 6.2 Application Service でのトランザクション表現（例: エントリー確定）

**現行の実行順序を厳密に保存する。** 実コード `submitEntryAction` は、同日重複確認（`findSameDayActiveEntries`）と事前満員判定（`tournament.remaining <= 0`）を **トランザクションの外・`createConfirmedEntry` 呼び出し前**に行い、`needsConfirm` や「満員です。キャンセル待ちへ…」を**早期 return** している。重複・定員の最終判定だけがトランザクション（`createConfirmedEntry` 内の `BEGIN IMMEDIATE`）内にある。OOP 化後もこの「ロック取得前チェック → ロック内で最終確定」の順序を保存する。UoW 内で `ConflictConfirmationRequiredError` を投げてはならない（書き込みロックを取ってから確認待ちで ROLLBACK することになり、現行のロック競合特性が変わる）。

したがって submit は次の 4 段を**この順序**で実行する。(1)〜(3) は UoW の**外**、(4) のみ UoW の**内**。

```typescript
// entries/application/EntryApplicationService.ts（抜粋）
submit(cmd: SubmitEntryCommand): SubmitOutcome {
  // (1) 前提・権限・メンバー構成（UoW 外）: Tournament/Team 取得、
  //     status==="OPEN" 検証（TournamentNotOpenError）、代表者/チーム権限
  //     （PermissionDeniedError(context)）、MemberComposition 検証。
  const tournament = this.tournaments.findById(cmd.tournamentId);
  if (!tournament) throw new NotFoundError();
  if (!tournament.isOpen()) throw new TournamentNotOpenError();
  // …権限・メンバー構成チェック（現行 actions の早期 return に対応）…

  // (2) 同日重複確認（UoW 外）: 未承認なら確認要求を早期 return。
  const conflicts = this.entries.findSameDayActiveEntryTitles(
    tournament.eventDate, cmd.userId, cmd.teamId, tournament.id,
  );
  if (conflicts.length > 0 && !cmd.acknowledgeConflict) {
    throw new ConflictConfirmationRequiredError(conflicts); // → needsConfirm
  }

  // (3) 事前満員判定（UoW 外）: ロック取得前に残枠 0 を弾き「満員です」を返す。
  //     ★これは EntryFullError ではなく専用の事前満員結果（別文言）。
  if (tournament.remaining(this.entries.countConfirmed(tournament.id)) <= 0) {
    return SubmitOutcome.preFull(); // → 「この大会は満員です。キャンセル待ちへご登録ください。」
  }

  // (4) UoW 内（BEGIN IMMEDIATE で書き込みロック即時取得）: TOCTOU 対策の
  //     重複「再」チェック + 定員「再」チェック + 挿入をアトミックに。
  const entry = this.uow.run(() => {
    if (this.entries.hasActiveEntry(cmd.tournamentId, cmd.userId, cmd.teamId)) {
      throw new DuplicateEntryError();            // → 「この大会には既にエントリー済みです。」
    }
    if (!tournament.canAcceptEntry(this.entries.countConfirmed(tournament.id))) {
      throw new EntryFullError();                 // → 「直前に満員となりました。…」（TOCTOU 専用の別文言）
    }
    const created = Entry.createConfirmed(cmd);   // 不変条件はエンティティが検証
    this.entries.insertConfirmed(created, created.members);
    return created;
  });
  return SubmitOutcome.confirmed(entry);
}
```

ポイント: 事前満員（(3)、「満員です。キャンセル待ちへ」）と、ロック内 TOCTOU 満員（(4) の `EntryFullError`、「直前に満員となりました。…」）は**別経路・別文言**であり、両方を保存する。`BEGIN IMMEDIATE` で書き込みロックを即時取得して TOCTOU を防ぐ点は現行どおり。通知ログ記録（`logNotification`）は **UoW の外（COMMIT 後、アダプタ層）**で行う（現行の挙動に合わせ、通知失敗が本処理をロールバックさせない）。

**`bulkSubmit` の挙動保存（トランザクション境界を束ねない）**: 現行 `submitBulkEntryAction` は単一 `submitEntryAction` を大会ごとに**逐次呼び出し**、各件を**独立したトランザクション**で確定する（1 件の失敗が他件をロールバックしない）。`EntryApplicationService.bulkSubmit` も同様に、内部で `submit` を大会ごとに逐次実行し、**各 `submit` が自身の `uow.run`（§6.1）を 1 回張る＝各件独立トランザクション**とする。**bulk 全体を 1 つの `uow.run` で包んではならない**（包むと「途中失敗で成功済み件も巻き戻る」という挙動変化になる）。集計結果の文言は現行と **1 バイト一致**で保存する: `${results.length}件中 ${okCount}件のエントリーが完了しました。`（`ok` フラグは `okCount > 0`）。したがって一括申込は §6.3 の「単一 UoW トランザクション対象」には含めない（各件の submit がそれぞれ §6.3-1 の対象）。

**bulk の「例外 → 集計エントリー」畳み込み（Finding 7 確定）**: submit が例外ベース（§4）へ変わるため、bulk アダプタ（`submitBulkEntryAction` 相当）は各 `submit` 呼び出しを **try/catch で囲み**、各件の結果を `{ tournamentId, ok, message }` の 1 エントリーへ畳み込む。畳み込み規則は現行の挙動と 1 バイト一致で保存する:
- `submit` が `SubmitOutcome.confirmed` を返した → `{ tournamentId, ok: true, message: "エントリーが完了しました。" }`（`submitEntryAction` 成功時の `message` と一致。現行 bulk の `r.message ?? (r.ok ? "完了" : "失敗")` は `r.message` が存在するため実質この文言になる）。
- `submit` が `SubmitOutcome.preFull` を返した / `DomainError`（`DuplicateEntryError`・`EntryFullError`・`TournamentNotOpenError`・`PermissionDeniedError`・`ConflictConfirmationRequiredError` 等）を throw した → アダプタの `toActionResult(error|outcome, context)` で §4.2 の該当文言へ変換し `{ tournamentId, ok: false, message: <該当文言> }` に畳む。
- 入力検証・前提エラー（チーム未指定等）も同様に `ok: false` + 該当文言へ畳む。
- `acknowledgeConflict` は現行どおり**全件へ一律伝播**する（各 `submit` コマンドに同じ値を渡す）。したがって bulk 内の 1 件が同日重複確認（`ConflictConfirmationRequiredError`）に該当した場合、その件は `ok: false` で集計に含まれ、他件は独立に進む（現行の自然な帰結を保存）。
- 各 `submit` は自身の `uow.run` を 1 回張る（§6.1）ため、ある件の例外・ROLLBACK は他件に波及しない。

### 6.2.1 waitlist（キャンセル待ち登録）の段取り（Finding 4 確定・分岐構造の保存）

`submitWaitlist`（`submitWaitlistAction` 相当）は submit とは**権限チェックのネスト構造が異なる**。実コードでは代表者チェック（`leaderOnlyWaitlist` 短縮文言）と `teamOwnership` 検証は、いずれも `if (requiresTeam(category))` ブロックの**内側**にネストされており、`requiresTeam` が偽（SINGLES）では到達しない。submit 側は `requiresLeader` チェックが `requiresTeam` チェックより**前・フラット**に置かれる。**この差を正規化してはならない**（submit のフラット構造へ寄せると SINGLES のキャンセル待ちで代表者文言が出る挙動変化になる）。

`submitWaitlist` の段取り（現行の分岐構造を保存）:
```typescript
// entries/application/EntryApplicationService.ts（抜粋。ネスト構造を現行どおり保存）
submitWaitlist(cmd: SubmitWaitlistCommand): Waitlist {
  const tournament = this.tournaments.findById(cmd.tournamentId);
  if (!tournament) throw new NotFoundError();              // 「大会が見つかりません。」
  const category = tournament.category;

  // User/Team は Application Service が注入リポジトリから取得する（取得元の層は Finding A の
  // 「権限判定は Application Service」に一致する）:
  const user = this.users.findById(cmd.userId);
  const team = this.teams.findById(cmd.teamId);
  const role = user.role;
  const isAdmin = user.isAdmin;

  let teamId: string | null = null;
  if (requiresTeam(category)) {                            // ← このブロック内側にのみ権限/チーム検証
    if (requiresLeader(category) && role !== "LEADER" && !isAdmin) {
      throw new PermissionDeniedError("leaderOnlyWaitlist"); // 「この種目は代表者のみ申込できます。」
    }
    // teamId 未指定・チーム不在はアダプタ層の前提エラー（§4.2 注）で早期 return
    if (team.leaderUserId !== cmd.userId && !isAdmin) {
      throw new PermissionDeniedError("teamOwnership");      // 「ご自身が代表を務めるチームでのみ申込できます。」
    }
    teamId = team.id;
  }

  // UoW 内: 重複判定 + 採番 + 挿入（現行 createWaitlist の BEGIN IMMEDIATE に対応）
  return this.uow.run(() => {
    if (this.entries.hasActiveWaitlist(cmd.tournamentId, cmd.userId, teamId)) {
      throw new DuplicateWaitlistError();                   // 「既にキャンセル待ちに登録済みです。」
    }
    const queueNumber = this.entries.nextQueueNumber(cmd.tournamentId); // ★新設（MAX+1）
    const waitlist = Waitlist.create(cmd, queueNumber);
    this.entries.insertWaitlist(waitlist);
    return waitlist;
  });
}
```
submit（§6.2）が受付期間外・代表者要件をフラットに前段で検証するのに対し、waitlist はそれらを `requiresTeam` ブロック内にのみ持つ点を保存する。通知ログ（順位を含む文言）は現行どおり COMMIT 後にアダプタ層が記録する。

### 6.2.2 cancel（キャンセル）の段取り（Finding 6 確定・UoW 内外の責務境界）

`cancel`（`cancelEntryAction` 相当）は、料率計算を **UoW の外**で行い、ステータス更新と `cancellations` 挿入のみを **UoW 内**でアトミックに実行する（現行 `cancelEntryAction` の順序を保存）。`Entry.cancel` と `CancelFeePolicy.calculate` の責務境界を次に一意化する。

1. **UoW 外（事前判定・料率計算）**:
   - `this.entries.findById(entryId)` が `null` → `NotFoundError`（アダプタ「エントリーが見つかりません。」）。
   - 権限判定は **Application Service（`EntryApplicationService.cancel`）が、注入された `TeamRepository`（および `UserRepository`）を使って行う**。本人 / チーム代表 / 管理者のいずれでもなければ `PermissionDeniedError("cancel")`（→「このエントリーをキャンセルする権限がありません。」）を throw する。現行アダプタが Team を引いて判定していたロジックは、**文言・分岐をそのまま維持したまま Application Service へ移設する（ビヘイビア保存。アダプタ層は権限判定を行わない）**。owner/team-leader/admin の判定に必要な `team = this.teams.findById(entry.teamId)` と `user = this.users.findById(cmd.userId)`（`role = user.role` / `isAdmin = user.isAdmin`）は、この Application Service が注入リポジトリから取得する。
   - `tournament` を取得（`null` なら「大会が見つかりません。」）。
   - **`policy` を cancel 冒頭で `new CancelFeePolicy()`（ステートレス VO）として生成する。** そのうえで **`entry.cancel(policy, when)` を呼ぶ**。`Entry.cancel` は不変条件 `status !== "CONFIRMED"` を検証し、違反時 `EntryNotCancellableError`（→「このエントリーはキャンセルできません。」）を throw する。検証を通過したら、引数で受け取った `CancelFeePolicy` を使い `policy.calculate(tournament.eventDate, tournament.entryFee, when)`（現行 `calculateCancelFee` を吸収。`when` 既定は現在時刻）で料率・請求額・日数差・有償フラグ・初期管理ステータスを算出し、**`Entry.cancel` が `Cancellation` エンティティを生成して返す**。
   - 責務境界の一意化: **料率計算ロジックそのものは `CancelFeePolicy.calculate` が所有**（純粋計算 VO、§5）。**`Cancellation` エンティティの生成と「キャンセル可否不変条件の検証」は `Entry.cancel` が所有**（`Entry.cancel` が内部で `policy.calculate` を呼ぶ）。したがって二重定義にならない。料率計算は UoW の外で完了する。
2. **UoW 内（原子的書き込み）**:
   - `this.entries.updateStatus(entryId, "CANCELLED")`（現行 `cancelEntry` の UPDATE 部）。
   - `this.entries.insertCancellation(cancellation)`（現行 `cancelEntry` の cancellations INSERT 部）。
   - この 2 操作を 1 回の `uow.run` でアトミックに実行する（現行 `cancelEntry` の `BEGIN IMMEDIATE` に対応）。
3. **COMMIT 後（UoW 外・アダプタ層）**: 通知ログ記録。現行どおり、無料/有償で `deliveryType` を分け（`CANCEL_FREE` / `CANCEL_PAID_USER`）、有償時はさらに管理者向け（`CANCEL_PAID_ADMIN`）を追加記録する。繰り上がり（waitlist OFFER）は現行どおりスタブ（記録のみ）。戻り文言は有償/無料で分岐（`キャンセルを受け付けました（キャンセル料 N%）。` / `キャンセルを受け付けました（無料）。`）し 1 バイト一致で保存。

### 6.3 対象トランザクション（既存規約 §6.1 準拠）

本リファクタリングでトランザクション境界を Application Service へ移すのは次の処理。いずれも現行の原子性・ロック取得挙動を保存する。
1. エントリー確定（定員排他 + entries/entry_members 挿入）。
2. キャンセル待ち登録（重複チェック + queue_number 採番 + waitlists 挿入）。
3. キャンセル（entries ステータス更新 + cancellations 挿入）。
4. メンバー全置換（entry_members 削除 + 再挿入 + entries.updated_at 更新）。

---

## 7. DI（手動コンストラクタ注入）とコンポジションルート

DI コンテナは導入しない。各クラスは依存を**コンストラクタ引数**で受け取り、`private readonly` フィールドに保持する。配線（どの interface にどの実装を注入するか）は唯一のコンポジションルート `src/server/container.ts` に集約する。

```typescript
// src/server/container.ts
import { db } from "@/lib/db";
import { SqliteUnitOfWork } from "@/lib/unitOfWork";
import { SqliteEntryRepository } from "@/features/entries/infrastructure/SqliteEntryRepository";
import { SqliteTournamentRepository } from "@/features/tournaments/infrastructure/SqliteTournamentRepository";
import { EntryApplicationService } from "@/features/entries/application/EntryApplicationService";

// シングルトン db を使うため、ファクトリは都度 new で十分（状態を持たない）。
export function createEntryApplicationService(): EntryApplicationService {
  const uow = new SqliteUnitOfWork(db);
  return new EntryApplicationService(
    uow,
    new SqliteEntryRepository(db),
    new SqliteTournamentRepository(db),
    new SqliteTeamRepository(db),
    new NotificationService(new SqliteNotificationRepository(db)),
  );
}
```

Server Action はこのファクトリを呼ぶだけ（`const service = createEntryApplicationService()`）。将来 Supabase へ移すときは `container.ts` の `SqliteXxxRepository` を `SupabaseXxxRepository` に差し替えるだけで、Application Service / Domain 層は無改修で済む（これが Repository interface 分離の目的）。

テストでは `container.ts` を経由せず、Application Service を直接 `new` し、Repository のインメモリ実装（または SQLite 実 DB）を注入する。

**インスタンス生成コスト**: Repository / Service はステートレス（保持するのは共有 `db` 参照のみ）なので、リクエストごとに `new` して問題ない。`db` は現行どおり `globalThis` シングルトンを共有する（`src/lib/db.ts` は変更しない）。

---

## 8. Feature 間クロスインポート禁止（既存規約 §1.2）の OOP 版運用

OOP 化後も「`features/<A>` から `features/<B>` の内部実装を直接 import しない」を厳守する。ただし現行でも実際には feature 間参照が存在する（例: `entries/actions.ts` → `auth/userRepository`, `tournaments/tournamentRepository`, `teams/teamRepository`, `notifications/notificationRepository`; `data/ranking.ts` → `auth/classLabel`）。これを OOP で健全化する方針は次のとおり。

1. **他 feature に依存してよいのは「その feature が公開する interface / ドメイン型 / Domain Service」に限る。** インフラ実装クラス（`Sqlite*Repository`）を他 feature から直接 new してはならない。配線はコンポジションルートのみが行う。
2. Application Service が他 feature のデータを必要とする場合、他 feature の **Repository interface** または **Domain Service** をコンストラクタ注入で受け取る（例: `EntryApplicationService` は `TournamentRepository`・`TeamRepository`・`UserRepository` interface を受け取る）。これらの interface の型は各 feature の `domain/` が公開する。
3. 複数 feature が共有する VO/Domain Service（例: `GranLevel`、ランキング整列）で、どの feature にも属しにくいものは、`src/domain/` 直下（共有ドメイン基盤）へ昇格させる（この昇格先 `domain/` は既存規約 §1.2 の列挙を本リファクタリングで拡張したもの。前文・§3・§10 ステップ6 参照）。`GranLevel` は auth（登録・現在ユーザー）と data（ランキング/分布/サマリ）の双方が使う。**決定事項: auth 着手時点で `GranLevel` を最初から `src/domain/GranLevel.ts` に置く（`auth/domain` を経由しない）。** 二重移設を避け、横展開（data）で `data → auth/domain` という feature 間 import を発生させないため。`GranLevelAssignmentService`（登録時の中央値算出）は auth 固有ロジックなので `auth/domain/` に置き、生成する `GranLevel` のみ共有基盤を参照する。
4. feature を跨ぐ import は「下位（domain の型/interface）」方向のみ許容し、循環を作らない。`entries → tournaments(domain)` のように一方向を保つ。なお `data → auth` の現行クロス参照（`data/ranking.ts` → `auth/classLabel`）は、`GranLevel` を `src/domain/`（共有基盤）へ置くこと（§8-3 決定事項）で**解消**し、data は feature 間 import ではなく共有基盤を参照する。

---

## 9. テスト戦略

Vitest 設定（`vitest.config.ts`）は現状維持（`include: src/**/__tests__/**`, `fileParallelism:false`, 単一フォーク直列）。配置も「対象コードに近接した `__tests__/`」を踏襲する。

- **ユニットテスト（DB 不要）**: VO・Domain Service（`CancelFeePolicy`, `GranLevel`, `RankingService`, `LevelDistributionService`, `EntryHistoryService`, `PeriodFilterService`, `TeamRatingService`, `CategoryRules`）。現行 `utils/__tests__` のテストを、メソッド呼び出しへ最小改変して移植する。fast-check のプロパティテスト（ランキング安定性・分布合計一致 等）もそのまま維持。
- **ユニットテスト（Repository をモック）**: Application Service は Repository interface をインメモリ fake に差し替えて、分岐（満員 / 重複 / 権限 / 受付期間外 / 同日重複確認）を DB なしで検証できる。これが interface 分離の副次的利点。
- **統合テスト（実 SQLite）**: `Sqlite*Repository` と `SqliteUnitOfWork` の原子性（定員排他・ロールバック）は現行同様、共有 `db` に対する直列実行で検証する。現行 `data/server/__tests__` の DB テストはこの層に対応する。
- **テスト容易性の指針**: Application Service が UoW を注入で受け取る構造により、トランザクション挙動をテストで差し替え・観測できる。Domain 層が DB 非依存なので、ドメインロジックのテストは高速・決定的になる。

「テストしにくい設計は見直す」観点で、現行の「Repository 内 BEGIN」から「Application Service が UoW を保持」へ移したことで、ユースケース分岐のユニットテストが DB 非依存化する点を重視した。

---

## 10. 段階導入計画

ビヘイビア保存を各段階で検証（`npm test` 全緑 + `npm run build`）しながら、小さく進める。

1. **設計（本書）**: 標準確定。レビュー反映。（本ステップ）
2. **共有基盤**: `src/domain/errors.ts`（DomainError 階層）、`src/lib/unitOfWork.ts`、`src/server/container.ts` の骨格を追加。既存コードは未変更で共存。
3. **パイロット: entries**: ドメインが最も濃い entries を最初に OOP 化する。`Entry`/`EntryMember`/`Waitlist`/`Cancellation` エンティティ、`CancelFeePolicy`/`MemberComposition` VO、`EntryRepository` interface + `SqliteEntryRepository`、`EntryApplicationService`、`actions.ts` をアダプタ化。`cancelFee.ts` / `category.ts` を移設。テスト移植・全緑で確定。
4. **横展開**: auth（`classLabel.ts`→`src/domain/GranLevel.ts`【共有基盤へ直接配置・§8-3】、`level.ts`→`auth/domain/GranLevelAssignmentService.ts`、`UserRepository`/`AuthApplicationService`）→ tournaments（`Tournament` エンティティ・`capacity.ts`/`category.ts` 吸収、境界 DTO 変換§2.1 を順守）→ teams → data（`DataViewService` と各 Domain Service、`ranking/distribution/entryHistory/period/teamRating` 移設。`GranLevel` は `src/domain/` を参照し `auth/domain` を直接 import しない）→ notifications（`NotificationRepository`/`NotificationService`）。各 feature 単位で全緑を維持。
5. **フロント統一**: 本リファクタリングはバックエンド中心だが、ユーザー要望のコンポーネント/テキストの一貫性は別途フロント標準（既存規約 §4 と `docs/ui-design-system.md`）に沿って整える。バックエンド OOP 化の外部契約維持により、フロントは原則無改修で追従する。
6. **最終ドキュメント更新**: `.github/Antigravity-instructions.md` に次の 3 つの改訂を、位置を一意に指定して行う（前 2 つは本書への参照追記、3 つめは §1.2 の昇格先列挙の拡張）。
   - **§1.2 の末尾（§2「命名規則」の直前）に参照を追記**: 「バックエンドのクラス構造・レイヤリング（Entity/VO/Domain Service/Repository/Application Service）は `docs/oop-architecture.md` に従うこと。」の一文。
   - **§1.2 の「Feature間の直接クロスインポート禁止」項の昇格先列挙を拡張**: 現行の「ルートの `components` / `types` / `utils` へ昇格させるか、Props / Context 経由で注入してください。」を、「ルートの `components` / `types` / `utils` / `domain`（共有ドメイン基盤: VO・共通例外・基底クラス）/ `lib`（例: `lib/unitOfWork`）/ `server`（コンポジションルート）へ昇格させるか、Props / Context 経由で注入してください。」へ改訂する。これにより本書が新設する `src/domain/` 等が規約上の正式な昇格先となり、前文で述べた「§1.2 の拡張」を規約本体で確定する。
   - **§6「データベース・サーバーサイド実装規約」の冒頭（§6.1 の直前）に参照を追記**: 「トランザクション境界・Repository interface・手動 DI の実装規約は `docs/oop-architecture.md` を参照」。内容的にはこちらが主たる参照先。
   - **§5.1 のキャンセル料サンプルへ注記を追加（Finding 8）**: 既存規約 §5.1 の `calculateCancelFee` サンプルは `Math.ceil` かつ `daysBefore >= 3 && daysBefore <= 7` 表記であり、実装（`cancelFee.ts`: `Math.round`・当日 0 起点・`daysBefore >= 3`）と異なる。§5.1 のサンプル直下に「**実装は `cancelFee.ts`（移設後は `CancelFeePolicy`）を正とする（`Math.round`／当日 0 起点）。本サンプルの `Math.ceil`・`daysBefore >= 3 && <= 7` は非規範（non-normative）であり、実装してはならない。**」の注記を追加する。これにより将来の実装者が誤って `Math.ceil` で再実装する回帰を防ぐ。
   - **§2「命名規則」のディレクトリ命名への注記を追加（Finding B）**: 既存規約 §2 は「ディレクトリ名は kebab-case」（`tournament-detail/` 等の複合語例を含む）と定めるが、バックエンド OOP レイヤ用ディレクトリ `domain` / `application` / `infrastructure`（および既存の `server` / `types` / `utils`）は単一小文字語である。§2 のディレクトリ命名規則の箇所に、これらのレイヤディレクトリが kebab-case の例外として単一小文字語である旨を、§1.2 拡張と同じ粒度（設計 §3 の命名を規約本文へ反映）で注記する。これにより規約 §2 と設計 §3 のディレクトリ命名の不一致を解消し、パイロット中のミッドストリーム判断を残さない。

   本リファクタリングの設計判断はすべて本書で確定済みであり、実装者がミッドストリームで下すアーキテクチャ判断は残さない（§8-3 の `GranLevel` 配置、§1.2 拡張、`category.ts` 関数写像、`SubmitOutcome` 型、`bulkSubmit` のトランザクション非束ねも決定済み）。

各段階の完了条件: 当該 feature の Server Action 外部契約が不変、`npm test` 全緑、`npm run build` 成功、DB スキーマ（`src/lib/db.ts`）無変更。

---

## 11. ビヘイビア保存チェックリスト（各 PR で確認）

- [ ] Server Action の関数名・引数・戻り値型（`EntryActionResult` / `AuthActionState` / `MyEntriesResult` / `DataViewData` 等）が不変。
- [ ] **entries 読み取り経路の DTO 不変条件（§2.1・Finding 1）**: `EntrySummary` / `MyEntriesResult` はプレーン DTO のまま。`EntrySummary.members` の要素型は `EntryMemberView`（DTO）であり、`EntryMember` クラス等のエンティティインスタンスを境界越えさせていない。`listSummaries` / `listMembers` はエンティティではなく DTO を返す。
- [ ] **`TournamentWithStats` / `TournamentCardData` の `remaining`（`number`）・`capacityStatus`（`"OPEN"|"FEW"|"FULL"`）がプレーンフィールドのまま**。クラスインスタンス／メソッドを `"use server"` 境界・Client Component へ渡していない（§2.1）。
- [ ] `src/lib/db.ts` の `CREATE TABLE` / CHECK / UNIQUE / INDEX / `NOW_JST` が無変更。
- [ ] ユーザー向けエラーメッセージ文言が現行と **1 バイト一致**（§4.2 (a)(b) 両表＝`toActionResult` マッピングで担保）。権限文言は `context` 別（cancel/updateMembers/leaderOnlySubmit/leaderOnlyWaitlist/teamOwnership）に保存。
- [ ] submit の実行順序が保存: 同日重複確認・事前満員判定は **UoW 外で早期 return**、UoW 内は重複/定員の再チェック + 挿入のみ（§6.2）。事前満員「満員です。…」（`SubmitOutcome.preFull`）と TOCTOU「直前に満員となりました。…」（`EntryFullError`）が別経路・別文言。
- [ ] `bulkSubmit` は `submit` を大会ごとに逐次実行し**各件独立トランザクション**（bulk 全体を 1 UoW で束ねない）。集計文言 `${results.length}件中 ${okCount}件のエントリーが完了しました。`・`ok = okCount > 0` を保存。各 `submit` の例外/`preFull` を try/catch で `{ tournamentId, ok:false, message }` へ畳み、`acknowledgeConflict` を全件一律伝播（§6.2・Finding 7）。
- [ ] **waitlist の分岐構造保存（§6.2.1・Finding 4）**: `submitWaitlist` の `leaderOnlyWaitlist` / `teamOwnership` 権限検証は `requiresTeam(category)` が真のブロック内側にのみ置く（submit のフラット構造へ正規化しない）。SINGLES のキャンセル待ちで代表者文言が出ないこと。
- [ ] **cancel の責務境界保存（§6.2.2・Finding 6）**: 料率計算（`CancelFeePolicy.calculate`）とキャンセル可否検証・`Cancellation` 生成（`Entry.cancel`）は UoW 外。`updateStatus` + `insertCancellation` のみ UoW 内。通知（無料/有償分岐・有償時の管理者通知）は COMMIT 後。
- [ ] トランザクション対象（§6.3）が `BEGIN IMMEDIATE` で原子実行され、失敗時 ROLLBACK される。
- [ ] 通知ログ記録のタイミング（COMMIT 後・本処理外）が現行と一致。
- [ ] 境界値が現行テストで検証され全緑: キャンセル料の日数差は `Math.round`（§5 のとおり `Math.ceil` ではない）/ 境界 8日・3日 / レベル 100〜999 / 充足率 75%（`confirmed/capacity >= 0.75` で FEW）/ ランキング同率同順位。
- [ ] `GranLevel.toTier()`（下限値境界）と `GranLevelAssignmentService` の中央値算出レンジ（`CLASS_RANGE`）が別定義のまま（統一していない）。
- [ ] `any` 不使用（既存規約 §3.1）、早期リターン（§7.1）、SQL は infrastructure 層のみ（§6）。

---

## 付録: 設計レビュー指摘への対応

### 付録 C: 第 3 回レビュー（`design-review.json` / `design-review.md`、判定 CHANGES_REQUESTED、HIGH 1 / MEDIUM 3 / NIT 4）への対応

本改訂は第 3 回実装前レビューの全 8 指摘に対応したものである。引用されたファイル名・シンボル・分岐構造は worktree 内の実コード（`entries/types/entry.ts`・`entries/server/actions.ts`・`entries/server/entryRepository.ts`）で再確認して裏付けた。

| # | 重大度 | 指摘要旨 | 対応 | 反映箇所 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | HIGH | `EntrySummary`（`members: EntryMember[]` を内包）が `"use server"` 境界を越えるが、`EntryMember`/`Entry` 等をエンティティ化すると §2.1 の「クラスインスタンスを境界越えさせない」不変条件に抵触。entries 読み取り経路の DTO 規約が欠落 | 対応（推奨案 (a) 採用 + 名前衝突解消）。エンティティ化を書き込み系内部表現に限定。`EntrySummary`/`MyEntriesResult` はプレーン DTO 維持、`members` 要素型を新設の読み取り DTO `EntryMemberView` に固定。書き込み系メンバーは `EntryMember` クラス（`entries/domain/`）と分離。§2.1 に entries 読み取り経路の「クラス vs DTO」1 文を追加 | §2.1（冒頭「クラス vs DTO の確定」・DTO 変換ルールに 1 文追加）、§5（entry.ts 新設行）、§11（新チェック項目） |
| 2 | MEDIUM | Repository I/O がエンティティか DTO か未確定。行→エンティティ rehydrate の所在未定義。`EntryMember` がエンティティ/DTO の両義 | 対応。「Repository I/O のドメイン型はエンティティクラス。行→エンティティは各 `SqliteXxxRepository` の private ファクトリ（`toEntry`/`toEntryMember`/`toWaitlist`/`toCancellation` を 1:1 移植）」を明記。`findById`=エンティティ、`listMembers`/`listSummaries`=DTO と一意化（`EntryMember` クラス vs `EntryMemberView` DTO） | §2.4（入出力型・rehydrate 規約、interface 注、実装クラス注、エンティティ/DTO 一意化） |
| 3 | MEDIUM | `ListSummaryParams` が interface で参照されるが未定義・未配置。ドメイン層の `types/` import 可否が曖昧 | 対応。`ListSummaryParams = { userId; teamId?; scope }` を `entries/types/entry.ts` に新設（現行インライン型の名前付き化）。「ドメイン層の import 禁止はインフラ/db/Zod/Next.js のみ。純粋型モジュール `types/` は import 可」を §2.4 に明記 | §2.4（import 方針・`ListSummaryParams` 定義）、§5（entry.ts 新設行） |
| 4 | MEDIUM | `submitWaitlist` の権限チェックが `requiresTeam` 内にネスト（SINGLES 到達不可）という分岐構造の保存が未明記。submit のフラット構造へ正規化される恐れ | 対応。§6.2.1（waitlist 段取り）を新設し、「権限/チーム検証は `requiresTeam` が真のブロック内側にのみ置く（正規化禁止）」を擬似コード付きで明記。§4.2(b) の `leaderOnlyWaitlist` 行に「`requiresTeam` 内ネスト・SINGLES 到達不可」を追記 | §6.2.1（新設）、§4.2(b)、§11（新チェック項目） |
| 5 | NIT | `entryRepository.ts` の補助型 4 種（`CreateEntryParams`/`CreateEntryResult`/`WaitlistResult`/`CancelEntryParams`）の移設先が §5 に無い | 対応。§5 entries 行に注記: Result 2 型は例外方針へ移行し廃止、`CreateEntryParams`→`SubmitEntryCommand`、`CancelEntryParams`→`cancel` 引数へ内部化、削除前に feature 外 import を grep 確認 | §5（entries 行・補助型注記） |
| 6 | NIT | cancel ユースケースの Application Service 段取りが submit と同粒度で未記載。`Entry.cancel` と `CancelFeePolicy.calculate` の責務が二重定義気味 | 対応。§6.2.2（cancel 段取り）を新設。UoW 外（findById→権限→`Entry.cancel` が `status !== 'CONFIRMED'` 検証・`policy.calculate` で `Cancellation` 生成）/ UoW 内（`updateStatus`+`insertCancellation`）/ COMMIT 後（通知）を一意化。責務境界（計算＝VO、不変条件検証と `Cancellation` 生成＝`Entry.cancel`）を明記 | §6.2.2（新設）、§11（新チェック項目） |
| 7 | NIT | bulk の例外→集計畳み込みと `acknowledgeConflict` 伝播が未明記 | 対応。§6.2 bulk ブロックに「各 submit を try/catch で囲み `DomainError`/`SubmitOutcome.preFull` を `toActionResult` で `{tournamentId, ok:false, message}` へ、`confirmed` を成功文言へ畳む。`acknowledgeConflict` は全件一律伝播」を明記 | §6.2（bulk 畳み込み規則）、§11 |
| 8 | NIT | 規約 §5.1 サンプル（`Math.ceil`/`>=3&&<=7`）の訂正が §10 ステップ6 の計画に無く回帰リスク | 対応。§10 ステップ6 に「§5.1 サンプルへ『実装（`cancelFee.ts`: `Math.round`・当日 0 起点）を正とし本サンプルは非規範』の注記を追加」の 1 項を追加 | §10 ステップ6 |

本改訂で新たに実コード確認して裏付けた事実: `EntrySummary` が `members: EntryMember[]` を持つフラット DTO であること（`entries/types/entry.ts`）、`submitWaitlistAction` の `leaderOnlyWaitlist`/`teamOwnership` が `if (requiresTeam(category))` 内側にネストされ SINGLES で到達しないこと（`entries/server/actions.ts`）、補助型 4 種が `entryRepository.ts` から export されていること、`cancelEntryAction` が料率計算を UoW 外・ステータス更新/cancellations 挿入を `cancelEntry` 内（UoW）で行い通知を COMMIT 後に記録すること。レビューの Verified Assumptions（技術スタック・全 11 関数・エラー文言・`Math.round`・レンジ別定義・0.75 境界）は本改訂でも維持する。

### 付録 A: 第 2 回レビュー（`design-review.json` / `design-review.md`、判定 CHANGES_REQUESTED、MEDIUM 1 / NIT 6）への対応

本改訂は第 2 回実装前レビューの全 7 指摘に対応したものである。各指摘の反映箇所は次のとおり（引用されたファイル名・シンボルは worktree 内の実コードで再確認して裏付けた）。

| # | 重大度 | 指摘要旨 | 対応 | 反映箇所 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | MEDIUM | 共有ドメイン基盤 `src/domain/` の配置が既存規約 §1.2 の昇格先列挙（`components`/`types`/`utils`）と整合しない。「準拠」主張は不正確で未解決の矛盾 | 対応（推奨案 (a) を採用）。「§1.2 準拠」を「§1.2 を本リファクタリングで拡張」へ書き換え、§10 ステップ6 のドキュメント更新に「§1.2 昇格先列挙へ `domain`/`lib/unitOfWork`/`server` を追記する改訂」を追加。前文・§3・§8-4 を整合 | 前文（§1.2 拡張の節を新設）、§3、§8-3、§10 ステップ6 |
| 2 | NIT | `t.remaining` の参照元を `useTournamentFilters.ts` としたのは誤り（同フックは `t.capacityStatus` のみ参照） | 対応。`capacityStatus` はフィルタフック、`remaining` は `ScheduleCards`/`ScheduleTable`/`GuidelinesViewer` が参照、と帰属を訂正 | §2.1（DTO 変換ルール） |
| 3 | NIT | §6.2 が使う `Tournament.isOpen()` が §2.1 の責務リストに無い | 対応。§2.1 の Tournament 責務に `isOpen(): boolean`（`status === "OPEN"`）を追加 | §2.1 |
| 4 | NIT | `category.ts` の 4 関数の移設先が関数単位で未確定。`isTeamCategory` が対応表に欠落 | 対応。`isTeamCategory`/`requiresLeader`/`requiresTeam` → `CategoryRules`、`memberCountRange` → `MemberComposition`（`CategoryRules` を内部利用）と関数単位で明記し、`isTeamCategory` をシンボル欄へ追加 | §5（category.ts 行） |
| 5 | NIT | 「公開は `buildDataViewData` のみ」が exported 型 `DataViewData` を見落とし | 対応。「公開ランタイムシンボルは 1 メソッドのみ。型 `DataViewData` は `DataViewService.ts` / `data/types` へ移し引き続き公開」と補足 | §5（dataViewData 行） |
| 6 | NIT | `SubmitOutcome`（`preFull()`/`confirmed()`）の型定義・判別方法が未記載。§4.2 (a) に preFull の文言経路が無い | 対応。`SubmitOutcome` を判別可能ユニオン（`{kind:"confirmed";entry} \| {kind:"preFull"}`）として §2.5 で定義。§4.2 (a) に preFull → 文言の経路を明記 | §2.5、§4.2 (a)、§6.2 |
| 7 | NIT | `bulkSubmit` の「全体を 1 UoW で束ねない・各件独立トランザクション・集計文言保存」要件が未明記 | 対応。§6.2 に `bulkSubmit` は `submit` を大会ごと逐次実行し各件独立トランザクション、集計文言 `${results.length}件中 ${okCount}件のエントリーが完了しました。` を 1 バイト一致で保存、と明記 | §6.2、§11（下記に追記） |

レビューが Verified とした前提（`entryRepository.ts` 全 11 関数、インライン COUNT/採番、エラー文言、`cancelFee.ts` の `Math.round`、`CLASS_RANGE` と `classLabel.ts` 境界の別定義、`capacity.ts` の 0.75 境界、config/package.json バージョン、既存規約章構成）は本改訂でも維持する。レビューの Unverified 項目（teams/notifications の個別リポジトリ写像、`TournamentQueryService` の責務、`entryViewData.ts`/`currentUser.ts`/`tournamentResultsGuard.ts` の内部）は、設計書が明示的に「各 feature 着手時に現物確認」と委ねた横展開フェーズの範囲であり、entries パイロットの妥当性には影響しない。

### 付録 B: 第 1 回レビュー（MEDIUM 4 / NIT 5）への対応

本改訂は第 1 回の実装前レビュー（判定 CHANGES_REQUESTED、MEDIUM 4 / NIT 5）の全指摘にも対応している。各指摘の反映箇所は次のとおり（すべて実コードを worktree 内で再確認して裏付けた）。

| # | 重大度 | 指摘要旨 | 対応 | 反映箇所 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | MEDIUM | `remaining`/`capacityStatus` は client が直接参照するフラットフィールド。境界で DTO へ戻す規約が欠落 | 対応。エンティティはメソッドで算出するが、Server Action/ビューはプレーンな `TournamentWithStats`/`TournamentCardData` を維持し、アダプタで DTO 変換する規約を追記。クラスインスタンスを境界越えさせない | §2.1（DTO 変換ルール）、§2.2、§11 チェックリスト |
| 2 | MEDIUM | §4.2 の文言が実コードと不一致。権限文言は操作別・種目別で単一例外では復元不能 | 対応。全文言を実コードと 1 バイト一致で転記。`PermissionDeniedError` に `context`（5 種）を持たせ、権限文言を全列挙した表を追加。`toActionResult` を正と明記 | §4.1（`PermissionContext`）、§4.2 (a)(b) 両表、§11 |
| 3 | MEDIUM | 同日確認・事前満員は現行では UoW 外で早期 return。TOCTOU 満員と別文言 | 対応。submit を 4 段（(1)〜(3) UoW 外 / (4) UoW 内）に明記。`ConflictConfirmationRequiredError` は UoW 外。事前満員と `EntryFullError` の別経路・別文言を保存 | §6.2（submit 擬似コード全面書き直し）、§4.2 (a)、§11 |
| 4 | MEDIUM | `EntryRepository` が現行公開関数を網羅していない（waitlist/listMembers/listInvolved/countActiveWaitlist）。`countConfirmed` は新設 | 対応。interface を全 11 関数の完全写像に拡張。waitlist 系は `EntryRepository` 同居と決定。`countConfirmed`/`nextQueueNumber` を新設と明記。§5 に完全対応行を追加 | §2.4（interface 全列挙 + 判断）、§5（entries 完全対応行） |
| 5 | NIT | `buildTeamRanking`/`buildSelfRankSummary` は非公開ヘルパ | 対応。公開は `buildDataViewData` のみと注記。ヘルパの吸収先を明記 | §5（dataViewData 行） |
| 6 | NIT | 「§1 直後」の参照位置が曖昧 | 対応。§1.2 末尾（§2 直前）と §6 冒頭（§6.1 直前）の 2 箇所に一意指定 | 前文、§10 ステップ6 |
| 7 | NIT | `GranLevel` 昇格先が未確定で判断がミッドストリームに残る | 対応。auth 着手時点で `src/domain/GranLevel.ts` に直接配置と決定。二重移設と `data→auth` import を回避 | §8-3、§8-4、§10 ステップ4/6 |
| 8 | NIT | 日数差の丸めが実コード `Math.round` と規約サンプル `Math.ceil` で食い違い | 対応。`Math.round`（当日0起点）を正とし、規約 §5.1 の `Math.ceil` は採用しない旨を注記 | §5（CancelFeePolicy 行）、§11 |
| 9 | NIT | 算出用 `CLASS_RANGE` と判定用 `toTier()` 境界を別定義のまま保存する要件が弱い | 対応。両者は別定義・統一禁止と明記。丸めは算出サービス側 | §5（level.ts 行 + 相互依存の保存注記）、§11 |

レビューの Unverified 項目のうち、本改訂で実コードを確認して確定したもの: 指摘 1（`useTournamentFilters.ts` の `t.capacityStatus`/`t.remaining` 値参照）、指摘 2（`actions.ts` の全文言）、指摘 3（submit の UoW 外事前チェック順序）、指摘 4（`entryRepository.ts` の全公開関数とインライン COUNT/採番）、指摘 5（`dataViewData.ts` の export は `buildDataViewData` のみ）、指摘 8（`cancelFee.ts` の `Math.round`）、指摘 9（`level.ts` の `CLASS_RANGE` と「階級判定には使用しないこと」コメント、`classLabel.ts` の下限境界）。残る Unverified（`vitest.config.ts` の `fileParallelism`、`db.ts` のスキーマ CHECK/UNIQUE 詳細、teams/notifications のリポジトリ内部）は各 feature 着手時に実装者が現物で確認する前提とし、§11 のスキーマ無変更チェックで担保する。
```

Let me verify the file was written and check the stack claims hold (tsconfig for the class-field setting I referenced).


<invoke name="file_search">
<parameter name="explanation">Confirm the design doc was written and check tsconfig.