# 設計レビュー（第 4 回）: GRAN OOP アーキテクチャ標準（`docs/oop-architecture.md`）

レビュー対象: `.worktrees/oop-refactor/docs/oop-architecture.md`（第 4 版相当。付録 A/B/C に第 1〜3 回レビュー対応履歴あり）
レビュー種別: 改訂レビュー（第 3 回レビュー `design-review.json` / `design-review.md` の指摘に対する再確認 + 変更差分の独立検証）
スポットチェックした実コード: `.github/Antigravity-instructions.md`（§1.2 昇格先列挙・§2 命名規則の位置・§5.1 `calculateCancelFee` サンプル）、`features/entries/types/entry.ts`、`features/entries/server/{actions.ts, entryRepository.ts}`、`features/entries/utils/cancelFee.ts`

---

## サマリ

本改訂は第 3 回レビュー（判定 CHANGES_REQUESTED、HIGH 1 / MEDIUM 3 / NIT 4）の全 8 指摘に正面から対応している。再確認の結果、**8 指摘すべてを Closed と判定**する（下記「第 3 回指摘の再確認」）。合意済みの主要設計判断（リッチエンティティ+ドメインサービス、Repository interface+SQLite 実装+手動 DI、`docs/oop-architecture.md` 新規作成と `Antigravity-instructions.md` からの参照・§1.2 拡張、utils 純粋関数のファイル単位移設マッピング、例外 vs Result 型の統一、トランザクション境界の UoW 表現、ビヘイビア保存とクロスインポート禁止、段階導入計画）はいずれも実コードと整合する形で反映されている。

ただし、改訂で新規追加された §6.2.1（waitlist）/ §6.2.2（cancel）の段取り記述と、既存 §6.2（submit）・§2.5 の間に、**権限チェックが「アダプタ層」で行われるのか「Application Service」で行われるのかが文書内で食い違う**新たな不整合が生じている（Finding A）。これは entries パイロット着手時に「権限ロジックをどの層へ置くか」という層境界の判断を実装者へ押し付けるため、設計段階で一意化すべきである。

判定: **CHANGES_REQUESTED**（HIGH 0 / MEDIUM 1 / NIT 2）。

---

## 第 3 回指摘の再確認（Closed / Unchanged）

| 旧# | 旧重大度 | 要旨 | 本改訂での状態 | 根拠 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | HIGH | `EntrySummary`（`members: EntryMember[]`）の境界越えに対する DTO 規約欠落。エンティティ化すると §2.1 不変条件に抵触 | **Closed** | §2.1 に「クラス vs DTO の確定」ブロックを新設。`EntrySummary`/`MyEntriesResult` をプレーン DTO 維持、`members` 要素型を新設 DTO `EntryMemberView`（`entries/types/entry.ts`、現行 `EntryMember` interface のフィールドを 1:1 継承）へ固定、書き込み系 `EntryMember` クラスは `entries/domain/` と分離。§5 entry.ts 新設行・§11 新チェック項目も追加。実コード（`entry.ts` の `EntrySummary.members: EntryMember[]`、`getMyEntriesAction`→`MyEntriesResult` が `"use server"` 境界越え）と整合 |
| 2 | MEDIUM | Repository I/O がエンティティか DTO か未確定。rehydrate の所在未定義 | **Closed** | §2.4 に「Repository の書き込み/単一・複数エンティティ取得はエンティティクラス、行→エンティティ rehydrate は各 `SqliteXxxRepository` の private ファクトリ（`toEntry`/`toEntryMember`/`toWaitlist`/`toCancellation` を 1:1 移植）」を明記。`findById`=エンティティ、`listMembers`/`listSummaries`=DTO と一意化。実コード `entryRepository.ts` に当該 4 変換関数が実在することを確認 |
| 3 | MEDIUM | `ListSummaryParams` が未定義・未配置。ドメイン層の `types/` import 可否が曖昧 | **Closed** | §2.4 に `ListSummaryParams = { userId; teamId?; scope }` を `entries/types/entry.ts` へ新設（現行インライン型の名前付き化）。「ドメイン層の import 禁止はインフラ/db/Zod/Next.js のみ。純粋型モジュール `types/` は可、`types/schema.ts`（Zod）は不可」を明記。実コード `listEntrySummaries` の現行インライン型 `{ userId; teamId?; scope }` と 1:1 一致 |
| 4 | MEDIUM | `submitWaitlist` の権限チェックが `requiresTeam` 内ネスト（SINGLES 到達不可）の保存が未明記 | **Closed** | §6.2.1 を新設し、擬似コードで「`leaderOnlyWaitlist`/`teamOwnership` 検証は `requiresTeam(category)` が真のブロック内側にのみ置く（submit のフラット構造へ正規化しない）」を明記。§4.2(b) `leaderOnlyWaitlist` 行にも「`requiresTeam` 内ネスト・SINGLES 到達不可」を追記。実コード `submitWaitlistAction` で両チェックが `if (requiresTeam(category))` 内側にネストされていることを確認 |
| 5 | NIT | 補助型 4 種（`CreateEntryParams`/`CreateEntryResult`/`WaitlistResult`/`CancelEntryParams`）の移設先が無い | **Closed** | §5 entries 行に注記: Result 2 型は例外方針へ移行し廃止、`CreateEntryParams`→`SubmitEntryCommand`、`CancelEntryParams`→`cancel` 引数へ内部化、削除前に feature 外 import を grep 確認。実コード `entryRepository.ts` が当該 4 型を export していることを確認 |
| 6 | NIT | cancel ユースケースの AppService 段取りが未記載。`Entry.cancel` と `CancelFeePolicy.calculate` の責務が二重定義気味 | **Closed**（ただし下記 Finding A で層帰属の副次的不整合が残存） | §6.2.2 を新設。UoW 外（findById→権限→`Entry.cancel` が `status !== "CONFIRMED"` 検証・`policy.calculate` で `Cancellation` 生成）/ UoW 内（`updateStatus`+`insertCancellation`）/ COMMIT 後（通知）を一意化。責務境界（計算＝VO、不変条件検証と `Cancellation` 生成＝`Entry.cancel`）も明記。実コード `cancelEntryAction` の順序（権限→`status`判定→`calculateCancelFee`→`cancelEntry`(UoW)→通知）と整合 |
| 7 | NIT | bulk の例外→集計畳み込みと `acknowledgeConflict` 伝播が未明記 | **Closed** | §6.2 bulk ブロックに畳み込み規則を明記。`confirmed`→`{ok:true, message:"エントリーが完了しました。"}`、`preFull`/`DomainError`→`toActionResult` で `{ok:false, message:<該当文言>}`、`acknowledgeConflict` は全件一律伝播。実コード `submitBulkEntryAction` の `message: r.message ?? (r.ok ? "完了" : "失敗")` は成功時 `r.message="エントリーが完了しました。"` が存在するため、設計の文言記載は現行実挙動と一致（設計が「実質この文言になる」と正しく注記） |
| 8 | NIT | 規約 §5.1 サンプル（`Math.ceil`/`>=3&&<=7`）の訂正が計画に無く回帰リスク | **Closed** | §10 ステップ6 に「§5.1 サンプルへ『実装（`cancelFee.ts`: `Math.round`・当日 0 起点）を正とし本サンプルは非規範』の注記を追加」の 1 項を追加。実コード `Antigravity-instructions.md` §5.1 が `Math.ceil`/`daysBefore >= 3 && <= 7`、`cancelFee.ts` が `Math.round`/`daysBefore >= 3` であることを確認（食い違いは実在。訂正計画は妥当） |

結論: 第 3 回の全 8 指摘は Closed。Unchanged（未対応のまま残った指摘）は無い。

---

## Findings（本改訂で新規／残存）

### A. [MEDIUM] 権限チェックの帰属層（アダプタ層 vs Application Service）が文書内で食い違う

**どこで**: §2.5（Application Service の責務）、§6.2 submit 擬似コード（コメント `// 代表者/チーム権限（PermissionDeniedError(context)）` と本文）、§6.2.1 submitWaitlist 擬似コード（`throw new PermissionDeniedError(...)` が `submitWaitlist` 本体内）、§6.2.2 cancel 1.（「権限判定… `PermissionDeniedError("cancel")` …**これはアダプタ層が Team を引いて判定する現行構造を保存**」）。

**問題**: 権限検証がどの層で行われるかが節ごとに矛盾している。
- §6.2（submit）は `submit(cmd)` 本体のコメントで「前提・権限・メンバー構成（UoW 外）」を Application Service 内で行うと記し、§6.2.1（waitlist）は `submitWaitlist(cmd)` 本体内で `throw new PermissionDeniedError("leaderOnlyWaitlist"|"teamOwnership")` を直接投げている。これは**権限チェックが Application Service 内**であることを含意する。
- 一方 §6.2.2（cancel）1. は「権限判定（…`PermissionDeniedError("cancel")`）。**これはアダプタ層が Team を引いて判定する現行構造を保存**」と明記し、**権限チェックがアダプタ層**であると述べている。
- さらに §4.2 冒頭は「ユーザー向け文言の正は**アダプタ層の純関数 `toActionResult`**」とし、§4.2(b) は「アダプタ層が `context` → 固定文言を返す」とする。これは例外→文言変換がアダプタである点のみを述べ、権限「判定」自体の層を一意化していない。

結果として、`PermissionDeniedError` を投げる主体が Application Service（submit/waitlist）なのかアダプタ層（cancel）なのかが割れており、entries パイロット着手時に「submit/cancel の権限ロジックを `EntryApplicationService` に置くか `actions.ts` アダプタに置くか」を実装者が判断せざるを得ない。しかも §2.5 は「Application Service は認証・入力検証の**後段**（ドメイン前提条件の確認）を担う」とし、§2.6 はアダプタの責務を「セッション取得・Zod 検証・配線・例外→Result 変換・revalidate」に限定しており、権限判定（User/Team を引いて `leaderUserId` を比較する処理）がどちらの列挙にも明示的に入っていない。これは Finding 2〜4（Repository I/O 型・waitlist 構造）と同じ「パイロット着手直後に効く層境界の未確定」である。

**具体修正（いずれかで一意化）**:
- (a) 推奨: 権限判定を **Application Service 内**に統一する。§2.6 のアダプタ責務から権限判定を除外したまま、§6.2.2 cancel 1. の「これはアダプタ層が Team を引いて判定する現行構造を保存」を「`EntryApplicationService.cancel` 内で、注入された `TeamRepository`（または `teamId` から引いた代表者情報）を用いて本人/チーム代表/管理者を判定する。現行アダプタの判定ロジックを Application Service へ移設する（ビヘイビア保存＝文言・分岐は不変、置き場所のみ移動）」へ書き換える。あわせて §2.5 の責務列挙に「ドメイン前提条件に含む権限判定（本人/チーム代表/管理者、代表者要件種目）」を 1 項追記する。submit/waitlist 擬似コードが既に service 内で投げている記述と整合する。
- (b) 代替: 権限判定を **アダプタ層**に統一する。その場合 §6.2/§6.2.1 の擬似コードから権限チェックを外し（`submit`/`submitWaitlist` は権限通過済みの前提で呼ばれる）、§2.6 アダプタ責務に「権限判定（User/Team を引いて本人/代表/管理者を確認し、不可なら `PermissionDeniedError(context)` を投げるか早期 return）」を追記する。ただしこの案は「ドメイン前提条件の確認は Application Service」という §2.5 の方針と衝突しやすいので、(a) を推奨する。

いずれでも、submit・waitlist・cancel・updateMembers の 4 ユースケースで権限判定の帰属層を**同一に**し、文書内の矛盾を解消すること。

---

### B. [NIT] OOP サブディレクトリ名（`domain`/`application`/`infrastructure`）が既存規約 §2「ディレクトリ名は `kebab-case`」と衝突する点の規約側整合が §10 ステップ6 の計画に無い

**どこで**: §3（「ディレクトリ名は既存規約 §2 の `kebab-case`… ではなく…小文字単語とする」）、§10 ステップ6（規約改訂計画）。

**問題**: §3 は OOP サブディレクトリを `domain`/`application`/`infrastructure`（単一小文字単語）とし、「既存規約 §2 の `kebab-case` ではなく、既存の `server`/`types`/`utils` の実態に合わせる」と明示的に逸脱を宣言している。実コード `Antigravity-instructions.md` §2 は確かに「ディレクトリ名 | `kebab-case`」と規定している（単一語は kebab-case と矛盾しないという解釈も可能だが、規約は例として `tournament-detail/` 等の複合語ハイフンを挙げており、OOP 層名が規約の明示例に無いのは第 3 回までの `§1.2 拡張` と同種の「規約本体に未反映の逸脱」である）。§10 ステップ6 の規約改訂は §1.2 昇格先・§5.1 サンプル・§6 参照の 3+1 項のみで、この §2 ディレクトリ命名の扱い（`domain`/`application`/`infrastructure` を規約 §2 の許容例として追記する、または「バックエンド層ディレクトリは小文字単語」と注記する）が計画に含まれていない。放置すると、§1.2 拡張で解消したはずの「規約と設計の不一致でミッドストリーム判断を迫る」状態が §2 命名で再発する。

**具体修正**: §10 ステップ6 に 1 項追加。「既存規約 §2『ディレクトリ名=`kebab-case`』へ、バックエンド OOP 層ディレクトリ `domain`/`application`/`infrastructure`（および既存 `server`/`types`/`utils`）は小文字単語とする旨の注記を追加し、設計 §3 の命名規則を規約本体にも反映する」。これにより §1.2 拡張と同じ粒度で規約との整合を取る。

---

### C. [NIT] §6.2.1 / §6.2.2 擬似コードで `role` / `isAdmin` / `team` の取得元が未提示（抜粋表記の曖昧さ）

**どこで**: §6.2.1 submitWaitlist 擬似コード（`role !== "LEADER"`、`isAdmin`、`team.leaderUserId`、`team.id` を未宣言で参照）、§6.2.2 cancel 1.（`Entry.cancel(policy, when)` の `policy`＝`CancelFeePolicy` インスタンスの生成元が未提示）。

**問題**: §6.2 submit 擬似コードは `this.tournaments.findById(...)` 等で依存取得を示すが、§6.2.1 の `role`/`isAdmin`/`team` は宣言なしに使われており（実コードでは `findUserById(session.sub)` と `findTeamById(data.teamId)` で取得）、どの Repository/サービスから、どの層で取得するかが擬似コード上で追えない。これは Finding A（権限判定の層帰属）と連動する曖昧さである。また §6.2.2 の `Entry.cancel(policy, when)` に渡す `policy`（`CancelFeePolicy`）を誰が生成するか（`new CancelFeePolicy()` をどの層で行うか）が明示されていない。設計は「抜粋」と断っており致命的ではないが、Finding A を (a) で一意化する際に、User/Team の取得主体（Application Service が `UserRepository`/`TeamRepository` を注入で持つ）を併記すると曖昧さが消える。

**具体修正**: Finding A の修正に合わせ、§6.2.1 冒頭に「`user`（`this.users.findById(cmd.userId)`）・`team`（`this.teams.findById(cmd.teamId)`）を Application Service が注入 Repository から取得。`role`=`user.role`、`isAdmin`=`user.isAdmin`」の 1 文を追加する。§6.2.2 の `policy` は「`cancel` 冒頭で `new CancelFeePolicy()` を生成（ステートレス VO）」と明記する。

---

## Verified Assumptions（本改訂で実コードに照らして裏付けた事実）

1. **`EntrySummary` の境界越え構造（Finding 1 対応の前提）**: `entries/types/entry.ts` の `EntrySummary` は `members: EntryMember[]` を持つフラット interface であり、`getMyEntriesAction`→`MyEntriesResult { personal/team: EntrySummary[] }` が `"use server"` 境界をクライアントへ越える。設計の「DTO 維持・`EntryMemberView` 分離」の前提は正しい。
2. **`listEntrySummaries` のインライン引数型（Finding 3 対応の前提）**: 実コードの引数は `{ userId: string; teamId?: string | null; scope: "personal" | "team" }` のインライン型。設計の `ListSummaryParams` 名前付き化は現行形と 1:1。
3. **`submitWaitlistAction` のネスト構造（Finding 4 対応の前提）**: `leaderOnlyWaitlist` 文言（「この種目は代表者のみ申込できます。」短縮）と `teamOwnership` 検証は、いずれも `if (requiresTeam(category))` ブロック内側にネストされ、SINGLES では到達しない。submit 側は `requiresLeader` チェックが `requiresTeam` より前・フラット。設計の分岐保存要件は現行挙動と一致。
4. **補助型 4 種の export（Finding 5 対応の前提）**: `entryRepository.ts` は `CreateEntryParams`・`CreateEntryResult`・`WaitlistResult`・`CancelEntryParams` を export している。設計の廃止/改名/grep 確認方針は妥当。
5. **行→ドメイン変換関数（Finding 2 対応の前提）**: `entryRepository.ts` に `toEntry`/`toEntryMember`/`toWaitlist`/`toCancellation` が private 相当（モジュール内関数）で実在。設計の「private ファクトリへ 1:1 移植」は現行ロジックと対応する。
6. **cancel フローの順序（Finding 6 対応の前提）**: `cancelEntryAction` は 権限判定 → `entry.status !== "CONFIRMED"` 判定 → `calculateCancelFee`（UoW 外）→ `cancelEntry`（UoW: UPDATE+INSERT）→ 通知（無料/有償分岐・有償時 `CANCEL_PAID_ADMIN` 追加、COMMIT 後）の順。設計 §6.2.2 の UoW 内外区分と一致。
7. **bulk 集計文言と各件独立呼び出し（Finding 7 対応の前提）**: `submitBulkEntryAction` は `for` ループ内で `submitEntryAction` を逐次 await（各件独立）、`message: r.message ?? (r.ok ? "完了" : "失敗")`、集計 `` `${results.length}件中 ${okCount}件のエントリーが完了しました。` ``・`ok: okCount > 0`。成功時 `r.message="エントリーが完了しました。"` のため設計の畳み込み文言は実挙動と一致。`acknowledgeConflict` は各件へ一律伝播。
8. **`cancelFee.ts` の計算（Finding 8 対応の前提）**: 日数差 `Math.round(diffMs / (1000*60*60*24))`（当日 0 起点 `toDateOnly`）、境界 `>= 8`→0% / `>= 3`→50% / else→100%、50% は `Math.floor(entryFee * 0.5)`。設計の「`Math.round`・当日 0 起点を正、`Math.ceil` 不採用」は正しい。
9. **規約 §5.1 サンプルとの食い違い（Finding 8 対応の前提）**: `Antigravity-instructions.md` §5.1 は `Math.ceil(diffTime / ...)` かつ `daysBefore >= 3 && daysBefore <= 7`。実装と食い違う。設計の「非規範注記を追加」計画は妥当。
10. **§1.2 昇格先列挙（§1.2 拡張の前提）**: 規約 §1.2「Feature間の直接クロスインポート禁止」は「ルートの `components` / `types` / `utils` へ昇格させるか、Props / Context 経由で注入してください。」と規定。`domain`/`lib/unitOfWork`/`server` は不在であり、設計の「§1.2 を拡張する」整理は正当（「準拠」ではない）。
11. **ドキュメント挿入位置（§10 ステップ6 の前提）**: 規約の `## 2. 命名規則` が §1.2 の直後に位置する。設計の「§1.2 末尾（§2 命名規則の直前）に参照追記」は実ファイル構造と一致。

---

## Unverified / Wrong Assumptions

### Wrong / 要訂正
- なし（実コードで確認した設計書の事実主張に、誤りは検出されなかった）。Finding A/B は設計**文書内部の不整合**（権限判定の層帰属、§2 命名の規約未反映）であり、実コードとの不一致ではない。

### Unverified（本レビューで実コード未確認。設計書が「各 feature 着手時に現物確認」と委ねた範囲を含む）
- `src/lib/db.ts` の `CREATE TABLE` / CHECK / UNIQUE / INDEX / `NOW_JST` の具体内容（§11 のスキーマ無変更チェックが担保する前提。本レビューではスキーマ本体を開いていない）。
- `vitest.config.ts` の `include` / `fileParallelism:false` / 単一フォーク直列（§9）。設定ファイル未確認。
- `tsconfig.json` / `package.json` の実測バージョン・`target`/`strict`/`useDefineForClassFields`（§1）。本改訂レビューでは再確認せず、第 3 回レビューの Verified を踏襲（第 3 回で一致確認済み）。
- `features/tournaments/utils/{category.ts, capacity.ts}`、`features/auth/utils/{level.ts, classLabel.ts}` の具体実装（§5 マッピング・`CLASS_RANGE` と `toTier()` 境界の別定義・0.75 境界）。本改訂レビューでは再確認せず、第 3 回レビューの Verified を踏襲。
- teams / notifications / tournaments（`Tournament` エンティティ）/ data の各 `server/xxxRepository.ts` の全公開関数と内部 `toXxx` 変換。設計が横展開フェーズで feature ごとに 1:1 対応表を作ると明示的に委ねており、entries パイロットの妥当性には影響しない。
- `entryViewData.ts` / `currentUser.ts` / `tournamentResultsGuard.ts` / `dataViewData.ts` の内部実装（`buildDataViewData` 公開性・`DataViewData` export は第 2 回レビューで確認済みと設計が主張。本レビューでは未再確認）。
- `src/domain/`・`src/lib/unitOfWork.ts`・`src/server/container.ts` は未作成（§10 ステップ2 で新設予定）のため、設計上の記述のみ。

---

## 判定

第 3 回の全 8 指摘は Closed。本改訂で新規に HIGH 0 / MEDIUM 1（Finding A）/ NIT 2（Finding B・C）。

HIGH+MEDIUM = 1 件（> 0）のため **CHANGES_REQUESTED**。

最優先は Finding A（権限判定の帰属層の文書内矛盾）。submit/waitlist は Application Service 内で `PermissionDeniedError` を投げる記述、cancel は「アダプタ層で判定」と明記しており、entries パイロット着手直後に層境界の判断を実装者へ迫る。推奨は (a)（Application Service へ統一し §2.5/§2.6/§6.2.2 を整合）。Finding B・C は規約整合と擬似コードの明確化で、Finding A の修正と同時に解消できる。
