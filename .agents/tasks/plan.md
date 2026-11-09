# Implementation Plan — GRAN バックエンド OOP リファクタリング

承認済み設計書 `docs/oop-architecture.md`（A案）に沿った、ビヘイビア保存の段階導入計画。作業は worktree `c:\Users\tanakaxj\Documents\Development\Repositry\GRAN_Application\GRAN_Application\.worktrees\oop-refactor` を基点に行う（相対パスは親ワークスペースに落ちるため使わない）。

検証コマンド（プロジェクト実測）: `npm test`（= `vitest --run`）/ `npx tsc --noEmit` / `npm run build`（= `next build`）。
ベースライン（本計画作成時に実測）: `npm test` = 43 passed / 12 files・0 failed、`tsc --noEmit` exit 0。申し送りが「既存赤」とした `dataRepository.results.test.ts` Property 7 は 3 回連続で green（再現せず＝fast-check のフレーク扱い。新規に壊さないこと）。`npm run build` は現在 SQLite の `database is locked`（errcode 261, `src/lib/db.ts:44`）でのみ失敗する——13:48 起動の node.exe 3 プロセス（dev/watcher）が `data/gran.db` の WAL ロックを保持しているため。これはコードの退行ではなく環境ロック。build 検証はロックが解放されている時に行う（ユーザーの node プロセスを無断で kill しない）。ロックで build できない場合は tsc+test が green であることと、build ブロッカーが外部ロックであることを記録する。

未クローズの設計レビュー指摘（`.agents/tasks/design-review.json` が CHANGES_REQUESTED のまま A:MEDIUM / B,C:NIT。採用解は `.agents/tasks/design-carryover.md`）を項目 1 で確実に閉じる。

- [ ] 1. 【申し送り A/B/C を解消 + 共有基盤】docs/oop-architecture.md を3点修正: (A) 権限判定を4ユースケース（submit/submitWaitlist/cancel/updateMembers）すべて Application Service 帰属に統一（§6.2.2 cancel step1 を注入 TeamRepository による判定へ書き換え、§2.5 責務リストに「権限判定＝ドメイン事前条件」を追加、§2.6 はアダプタの例外→Result 変換のみを維持）; (B) §10 ステップ6 に「規約 §2 のディレクトリ命名に domain/application/infrastructure が単一小文字語である注記を追加」する項目を追記; (C) §6.2.1 に user=this.users.findById(cmd.userId)/team=this.teams.findById(cmd.teamId)/role=user.role/isAdmin=user.isAdmin、§6.2.2 に policy=new CancelFeePolicy() の取得・生成元を明記。続けて共有基盤を新規追加（既存ランタイムは未変更）: `src/domain/errors.ts`（§4.1 の DomainError 階層一式）、`src/lib/unitOfWork.ts`（SqliteUnitOfWork.run<T>: BEGIN IMMEDIATE→work→COMMIT、例外時 ROLLBACK 再throw）、`src/server/container.ts`（コンポジションルート骨格。db と SqliteUnitOfWork を import し、FEAT-002 で entries ファクトリを足せる形にする）。
      Files: docs/oop-architecture.md, src/domain/errors.ts, src/lib/unitOfWork.ts, src/server/container.ts
      Verify: `npx tsc --noEmit`（exit 0）、`npm test`（43 passed 維持）、`npm run build`（成功。外部ロック時は上記 caveat を適用）。

- [ ] 2. 【entries パイロット】設計標準に沿って entries を class 化。読み取り DTO/型を `src/features/entries/types/entry.ts` に追加（`EntryMemberView`＝現 EntryMember interface と 1:1、`EntrySummary.members` を `EntryMemberView[]` へ、`ListSummaryParams`）。VO/ルール: `entries/domain/CancelFeePolicy.ts`（cancelFee.ts を厳密移植: Math.round 当日0起点、≥8→0% / ≥3→50% Math.floor / else 100%、Math.ceil 禁止）、`tournaments/domain/CategoryRules.ts`（category.ts の isTeamCategory/requiresLeader/requiresTeam）、`entries/domain/MemberComposition.ts`（memberCountRange）。エンティティ: `entries/domain/{Entry,EntryMember,Waitlist,Cancellation}.ts`（Entry.createConfirmed / Entry.cancel(policy,when)→status 検証＋Cancellation 生成）。`entries/domain/EntryRepository.ts`（§2.4 の全11メソッド写像＋新設 countConfirmed/nextQueueNumber、Repository はトランザクションを張らない）。`entries/infrastructure/SqliteEntryRepository.ts`（entryRepository.ts の SQL と toEntry 系 private を 1:1 移植、listMembers/listSummaries は DTO 組み立て）。`entries/application/EntryApplicationService.ts`（use server を持たない。SubmitOutcome 判別ユニオン、submit は §6.2 の4段＝(1)-(3) UoW外早期return・(4) UoW内再チェック+挿入、submitWaitlist は §6.2.1 の requiresTeam ネスト保存、cancel は §6.2.2、bulkSubmit は各件独立 uow.run。権限判定は本サービスに集約＝申し送り A）。アダプタ純関数 `toActionResult`（§4.2 の全文言を 1 バイト一致でマップ）。`src/features/entries/server/actions.ts` を薄いアダプタへ（名前/引数/戻り値 EntryActionResult・MyEntriesResult 不変、createEntryApplicationService() を container.ts に配線、logNotification は COMMIT 後、bulk 集計文言 `${results.length}件中 ${okCount}件のエントリーが完了しました。`）。新規ユニットテストを entries/domain・application に追加（cancelFee/category は現状テスト無しのため新設）。cancelFee.ts 削除は補助型4種の feature 外 import を grep 確認後。
      Files: src/features/entries/types/entry.ts, src/features/entries/domain/{CancelFeePolicy,MemberComposition,Entry,EntryMember,Waitlist,Cancellation,EntryRepository}.ts, src/features/tournaments/domain/CategoryRules.ts, src/features/entries/infrastructure/SqliteEntryRepository.ts, src/features/entries/application/EntryApplicationService.ts, src/features/entries/server/actions.ts, src/server/container.ts, src/features/entries/domain/__tests__/*, src/features/entries/utils/cancelFee.ts（削除）
      Verify: `npx vitest run src/features/entries`（新テスト green）、`npm test`（既存＋新規すべて green）、`npx tsc --noEmit`、`npm run build`（caveat 適用可）。

- [ ] 3. 【横展開】パイロットのパターンを §10 の順で適用: auth→tournaments→teams→data→notifications。auth: `src/domain/GranLevel.ts`（§8-3 で共有基盤へ直接配置。toTier 下限境界、toClassLabel）、`auth/domain/GranLevelAssignmentService.ts`（CLASS_RANGE 中央値、toTier 境界と別定義のまま）、UserRepository/SqliteUserRepository、AuthApplicationService/CurrentUserService、auth/server/actions.ts 薄化（AuthActionState 不変、ログイン失敗は汎用文言）。`data/utils/__tests__/tier.test.ts` の granLevelToTier import を新 GranLevel へ更新。tournaments: Tournament エンティティ（capacity.ts の remaining/capacityStatus、isOpen/canAcceptEntry 吸収）、TournamentRepository/Sqlite 実装、ただし TournamentWithStats/TournamentCardData の remaining:number・capacityStatus は境界でプレーン維持（useTournamentFilters/ScheduleCards/ScheduleTable/GuidelinesViewer が値参照）。teams: TeamRepository/Sqlite 実装で FEAT-002 の暫定 shim を置換。data: RankingService/LevelDistributionService/EntryHistoryService/PeriodFilterService/TeamRatingService + DataViewService（buildDataViewData を単一公開メソッド、DataViewData 型は公開維持）、DataRepository/Sqlite 実装（tournamentResultsGuard 吸収）、GranLevel は src/domain を参照し data→auth クロス参照を解消。notifications: NotificationRepository/Sqlite 実装 + NotificationService で shim 置換。各サブフェーズ後に container.ts 配線更新、feature 間 import は公開 interface/ドメイン型のみ。
      Files: src/domain/GranLevel.ts, src/features/auth/{domain,infrastructure,application,server}/*, src/features/tournaments/{domain,infrastructure,application,server}/*, src/features/teams/{domain,infrastructure}/*, src/features/data/{domain,application,infrastructure}/*, src/features/notifications/{domain,infrastructure,application}/*, src/server/container.ts, src/features/data/utils/__tests__/tier.test.ts（import 更新）, 各 utils 移設元の削除
      Verify: サブフェーズごとに `npx vitest run src/features/<f>` → `npm test` → `npx tsc --noEmit` → `npm run build`（caveat 適用可）。全 green を維持してからコミット（refactor(<feature>): ...）。

- [ ] 4. 【フロント統一】各ページで不統一なコンポーネント利用・テキスト（ボタン文言、ステータスラベル等）を洗い出し、共通コンポーネント/共通定数へ集約。ステータス→表示ラベルのマッピングを単一の source of truth 化（EntryStatus/WaitlistStatus/TournamentTier/CapacityStatus をキーに網羅的・型安全に。src/types または src/components へ昇格）。共通 Badge/Button を src/components/ui に用意（docs/ui-design-system.md と規約 §4 のセマンティックトークン準拠）。Server Action 契約として保存される文言は変更しない（集約であって言い換えではない）。ラベルマッピングと共通コンポーネントのテストを追加。
      Files: src/components/ui/*, src/types/*（新ステータスラベル定数）, src/features/*/components/*, src/components/**/__tests__/*
      Verify: `npx vitest run src/components src/features`、`npm test`、`npx tsc --noEmit`、`npm run build`（caveat 適用可）。

- [ ] 5. 【最終ドキュメント更新】docs/oop-architecture.md を実装結果（パス/クラス名/メソッド名）と一致させる。.github/Antigravity-instructions.md を改訂: §1.2 昇格先列挙に `domain`/`lib`（unitOfWork）/`server`（コンポジションルート）を追記＋本書への参照一文、§2 ディレクトリ命名に domain/application/infrastructure（＋server/types/utils）が単一小文字語である注記（申し送り B）、§6 冒頭に docs/oop-architecture.md 参照、§5.1 キャンセル料サンプルに「実装（cancelFee.ts / CancelFeePolicy）を正とし Math.round・当日0起点、サンプルの Math.ceil・>=3&&<=7 は非規範」注記。
      Files: docs/oop-architecture.md, .github/Antigravity-instructions.md
      Verify: `npx tsc --noEmit`、`npm test`、`npm run build`（caveat 適用可）——ドキュメントのみの変更で何も壊さないこと。

収束（実装レビューループ）: 上記の各段階完了後、統合検証（全 `npm test` / `npx tsc --noEmit` / `npm run build`）を実行し、レビュー判定を `.agents/tasks/review.json` の `verdict` に書く。`verdict` が `APPROVED` になったらループ停止。

## Digest

ファイルごとの変更ブロック・カバーするテスト・検証状況。coder は編集時のみ各ファイルを開く。

### 新規作成（共有基盤・FEAT-001）
- `src/domain/errors.ts`（新規）: `abstract class DomainError extends Error { abstract readonly code: string }` と §4.1 の全サブクラス（EntryFullError/DuplicateEntryError/DuplicateWaitlistError/EntryNotCancellableError/TournamentNotOpenError/NotFoundError/MemberCompositionError、`PermissionContext` union、`PermissionDeniedError{ context }`、`ConflictConfirmationRequiredError{ conflictTournaments: string[] }`）。DB/Zod/Next 非依存。テスト: entries application テスト（FEAT-002）が throw/型を間接検証。検証: tsc。
- `src/lib/unitOfWork.ts`（新規）: `class SqliteUnitOfWork { constructor(private readonly db: DatabaseSync){} run<T>(work:()=>T):T }`。`DatabaseSync` は `node:sqlite`（type import 可）。テスト: SqliteEntryRepository 統合テスト（FEAT-002）がロールバック原子性を検証。
- `src/server/container.ts`（新規→FEAT-002/003 で拡張）: `import { db } from '@/lib/db'`、`createEntryApplicationService()` 等のファクトリ。テスト: 間接（アダプタ経由）。

### entries パイロット（FEAT-002）— 現状確認済み署名
- `src/features/entries/types/entry.ts`: 既存 `Entry/EntryMember/Waitlist/Cancellation/EntrySummary` interface と `EntryStatus`/`MemberType`（確認済み）。変更=`EntryMemberView`（EntryMember と 1:1）・`ListSummaryParams = { userId: string; teamId?: string|null; scope: "personal"|"team" }` を追加、`EntrySummary.members: EntryMemberView[]` へ。これらは use server 境界を越えるので形を保存。
- `src/features/entries/server/actions.ts`: 現状の公開関数 `submitEntryAction/submitBulkEntryAction/submitWaitlistAction/cancelEntryAction/updateMembersAction/getMyEntriesAction` と `EntryActionResult`/`MyEntriesResult`（確認済み）。変更=本体をサービス委譲へ縮退、名前/引数/戻り値・全文言・分岐順・通知タイミングを 1 バイト／1:1 保存。テスト: 新 `entries/domain/__tests__` + `entries/application/__tests__`（toActionResult 文言一致、submit 4段、waitlist ネスト、cancel 無料/有償、bulk 集計）。
- `src/features/entries/server/entryRepository.ts`: 現状 11 公開関数＋`toEntry/toEntryMember/toWaitlist/toCancellation`＋インライン COUNT/採番＋補助型 `CreateEntryParams/CreateEntryResult/WaitlistResult/CancelEntryParams`（確認済み）。変更=SQL と private 行変換を `SqliteEntryRepository` へ移植、トランザクション関数を単一操作へ分解、Result 型は例外方針へ移行し廃止（feature 外 import を grep 後）。
- `src/features/entries/utils/cancelFee.ts`: `calculateCancelFee(eventDate, entryFee, cancelDate=new Date())`、`CancelFeeResult`、`toDateOnly`、`Math.round(diffMs/86400000)`、境界 ≥8/≥3（確認済み）。→ `CancelFeePolicy.calculate` へ厳密移植後、削除。新規テストが境界 8/3/当日・過去と Math.floor を検証。
- `src/features/tournaments/utils/category.ts`: `isTeamCategory/requiresLeader/requiresTeam/memberCountRange`、`requiresLeader=isTeamCategory||DOUBLES`、`requiresTeam=requiresLeader`、既定 SINGLES 1/1・DOUBLES 2/2・団体 4..6（確認済み）。→ `CategoryRules`＋`MemberComposition` へ。tournaments/auth の既存 import を壊さないよう FEAT-002 では委譲/再エクスポートで橋渡し、FEAT-003 で撤去。

### 横展開（FEAT-003）— 現状確認済み署名
- `src/features/tournaments/utils/capacity.ts`: `calcRemaining(capacity,confirmedCount)`/`calcCapacityStatus(...)`/`CapacityStatus="OPEN"|"FEW"|"FULL"`、`ratio>=0.75`→FEW（確認済み）。→ Tournament エンティティのメソッドへ。境界でプレーン維持。
- `src/features/auth/utils/classLabel.ts`: `granLevelToTier`（下限 850/750/650/550/450/350/250/else DE）/`granLevelToClassLabel`（確認済み）。→ `src/domain/GranLevel.ts`（§8-3）。
- `src/features/auth/utils/level.ts`: `estimateInitialGranLevel`＋`CLASS_RANGE`（中央値専用・一部オーバーラップ、toTier 境界と別物）、`Math.max(100,Math.min(999,Math.round((min+max)/2)))`（確認済み）。→ `auth/domain/GranLevelAssignmentService.ts`。統一禁止。
- `src/features/auth/server/currentUser.ts`: `getCurrentUser`/`toCurrentUser`（granLevelToClassLabel 利用、未査定は "査定中"）（確認済み）。→ `CurrentUserService`、GranLevel.toClassLabel 経由。
- `src/features/data/server/dataViewData.ts`: 公開 `buildDataViewData(viewer,viewerId)` と export 型 `DataViewData`、private `buildTeamRanking`/`buildSelfRankSummary`、`data/utils` と `auth/utils/classLabel` を利用（確認済み）。→ `DataViewService`＋各 Domain Service。GranLevel は src/domain 参照で data→auth クロス参照を解消。
- `src/features/data/utils/__tests__/tier.test.ts`: `granLevelToTier` を `@/features/auth/utils/classLabel` から import（確認済み）。→ 新 `src/domain/GranLevel` へ import 更新。fast-check プロパティ（tier 一致）維持。

### 既存テスト（移設/維持対象、確認済み・現状 43 passed）
- `src/features/data/utils/__tests__/{ranking,distribution,entryHistory,teamRating,tier}.test.ts`、`src/features/data/server/__tests__/{dataRepository.fallback,privacy,ranking,results}.test.ts`、`src/features/data/components/__tests__/panels.branches.test.tsx`、`src/app/(user)/data/__tests__/page.test.ts`、`src/components/layout/__tests__/navConfig.test.ts`。横展開/フロント統一で移設先メソッド呼び出しへ最小改変。`dataRepository.results.test.ts` Property 7 は現状 green（新規に悪化させない）。

### 検証状況（本計画作成時点、worktree 実測）
- `npm test`: 43 passed / 12 files・0 failed。
- `npx tsc --noEmit`: exit 0。
- `npm run build`: SQLite `database is locked`（errcode 261, `src/lib/db.ts:44`）でのみ失敗＝外部 node プロセス（13:48 起動 ×3）の WAL ロック。コード退行ではない。ロック解放時に成功を確認すること。
