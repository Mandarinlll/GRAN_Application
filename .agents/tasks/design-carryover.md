# 設計フェーズからの申し送り事項（MUST: plan / 実装で解消すること）

design-loop は 4 周で収束し、HIGH 0・事実誤り 0 の状態で完了扱いとした。
核となる設計判断（A案リッチエンティティ+ドメインサービス、Repository interface+SQLite実装+手動DI、
docs 新規作成+規約参照、§1.2 拡張、utils 移設マッピング、例外/Result 統一、UoW トランザクション境界、
ビヘイビア保存、クロスインポート禁止、段階導入計画）はすべて設計書 `docs/oop-architecture.md` に反映済み。

ただし第4回レビュー（.agents/tasks/design-review.json / design-review.md）で未クローズの
MEDIUM 1 / NIT 2 が残っている。**entries パイロット着手前に、これらをレビュー提示の解で確定させること。**
いずれも「どう直すか」はレビューに明記済みで判断の余地はない。

## [MEDIUM A] 権限チェックの帰属レイヤを一意化（最優先・entries パイロットに直結）
- 問題: submit/waitlist は Application Service 内で `PermissionDeniedError` を throw する擬似コードなのに、
  cancel step1 は「アダプタ層で Team を引いて判定」と書かれ、層が矛盾している。
- **採用解（レビュー推奨 (a)）**: 権限判定を **Application Service に統一**する。4ユースケース
  （submit / submitWaitlist / cancel / updateMembers）すべてで、注入された TeamRepository を使って
  owner / team-leader / admin を判定する。現行アダプタの判定ロジックは**文言・分岐をそのまま維持したまま
  Application Service へ移設**（ビヘイビア保存）。`docs/oop-architecture.md` の §6.2.2 cancel step1 を
  この形に書き換え、§2.5 の責務リストに「権限判定（本人 / チーム代表 / 管理者、代表者限定カテゴリ）を
  ドメイン事前条件として扱う」を追加する。アダプタ (§2.6) は従来どおり例外→Result 変換のみ。

## [NIT B] 規約 §2 ディレクトリ命名の整合を §10 ステップ6 の規約更新に追加
- OOP レイヤ用ディレクトリ `domain/ application/ infrastructure/`（および既存 `server/ types/ utils/`）は
  kebab-case 規約 §2 の例外として単一小文字語である旨を、§1.2 拡張と同じ粒度で
  `.github/Antigravity-instructions.md` の規約本文へ反映する計画を §10 ステップ6 に1項目追加する。

## [NIT C] 擬似コードの User/Team/Policy 取得元を明示
- §6.2.1 submitWaitlist: `user = this.users.findById(cmd.userId)` / `team = this.teams.findById(cmd.teamId)` を
  Application Service が注入リポジトリから取得し、`role = user.role` / `isAdmin = user.isAdmin` とする行を追記。
- §6.2.2 cancel: `policy` は cancel 冒頭で `new CancelFeePolicy()`（ステートレス VO）として生成する旨を明記。
- MEDIUM A の修正と同時に対応すること（取得元の層が A と連動するため）。

## 実装時の鉄則（再掲）
- ビヘイビア保存。DB スキーマ（src/lib/db.ts の CREATE TABLE）不変。use server 境界をクラスインスタンスで越えない
  （読み取り=DTO、書き込み=エンティティ）。各段階で `npm run test` / 型チェック / `npm run build` をグリーン維持。
- ベースラインで既に1件赤のテストがある（dataRepository.results.test.ts の fast-check プロパティ 7、作業前からの既存失敗）。
  これは本リファクタリングで新たに壊したものではない。挙動保存の観点で**この既存失敗を新規に悪化させないこと**。
  余力があれば原因（recordedAt 同値時の順序）を調査してよいが、スコープ外の深掘りは不要。
