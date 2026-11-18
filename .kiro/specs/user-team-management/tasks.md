# Implementation Plan: ユーザ・チーム管理

## Overview

管理コンソールに「ユーザ・チーム管理」を追加する実装計画。実装言語は TypeScript（design.md に準拠）。下層（スキーマ・セッション失効・純粋関数）から、リポジトリ、サービス、Route Handler、画面の順に積み上げ、最後に結線する。テストは vitest 3.2.4 と fast-check 4.10.2 を使い、`__tests__` を実装の隣に置く。

## Tasks

- [x] 1. スキーマ・セッション失効・トランザクション基盤
  - [x] 1.1 `src/lib/db.ts` にスキーマを追加する
    - `ensureColumn("users", "session_version", "INTEGER NOT NULL DEFAULT 0")` を追加する
    - `admin_account_logs` を `CREATE TABLE IF NOT EXISTS` で定義する（`action` 50 文字、`target_type` の CHECK、`operator_user_id` は `ON DELETE RESTRICT`、`detail` 2,000 文字、`created_at` は DEFAULT なし）
    - `idx_admin_account_logs_target ON admin_account_logs(target_type, target_id, created_at DESC)` を作成する
    - _Requirements: 14.1, 14.2, 14.7_

  - [x] 1.2 セッション失効を実装する
    - `src/types/user.ts` の `SessionPayload` に `sv?: number` を追加する
    - `src/lib/sessionValidity.ts` に純粋関数 `evaluateSessionValidity` を作る（行なし・`SUSPENDED`・`session_version` 不一致で無効）
    - `src/lib/sessionState.ts` に `findSessionState` と `revokeSessions`（`session_version + 1`）を作る
    - `src/lib/session.ts` を変更し、`setSessionCookie` で `sv` を JWT に入れ、`getSession()` で検証する。`sv` なしの既存 JWT は DB 値が 0 の間は有効のままにする
    - _Requirements: 6.3, 7.2, 8.2, 10.7_

  - [x] 1.3 `src/lib/transaction.ts` に `runInTransaction` を実装する
    - `BEGIN IMMEDIATE`、`ok: false` または例外で `ROLLBACK`、成功で `COMMIT`。入れ子は不可
    - _Requirements: 14.4, 14.5_

  - [ ]* 1.4 Property 13 のプロパティテストを書く
    - **Property 13: 既存セッションの失効**
    - `evaluateSessionValidity` の純粋関数テストと、`revokeSessions` の `session_version` 増加・他ユーザー不変の確認
    - **Validates: Requirements 6.3, 7.2, 8.2, 10.7**

  - [ ]* 1.5 マイグレーションのテストを書く
    - 旧スキーマに行を作り `applySchema` を複数回実行しても、既存行が変わらず `session_version = 0` で、エラーにならないことを確認する
    - _Requirements: 14.1, 14.2, 14.7_

- [x] 2. 型・純粋関数・入力検証
  - [x] 2.1 型と HTTP 変換を作る
    - `src/features/accounts/types/account.ts` に `ErrorCode`、`ServiceResult`、`UserListRow`、`UserDetail`、`TeamListRow`、`TeamDetail`、`AdminLogRow`、`CreateUserInput` を定義する（`passwordHash` に相当するプロパティは持たせない）
    - `src/features/accounts/server/httpResult.ts` で `ServiceResult` を HTTP ステータス（401/403/404/400/409/500）に変換し、`initialPassword` を含む応答に `Cache-Control: no-store` を付ける
    - _Requirements: 2.11, 3.5, 6.4, 14.6_

  - [x] 2.2 状態判定の純粋関数を作る
    - `utils/lockState.ts`（`isAccountLocked`、`LOCKED_SQL`）
    - `utils/statusTransition.ts`（`planStatusChange`）
    - `utils/roleChange.ts`（`planRoleChange`。判定順は design.md のとおり）
    - `utils/calibration.ts`（`CALIBRATION_RANGE`、`calibrationMidpoint`（floor）、`isOutOfRange`、`parseGranLevel`）
    - _Requirements: 4.5, 5.1, 5.2, 7.1, 7.3, 7.7, 8.1, 8.4, 8.5, 8.6, 8.7, 8.8, 9.3, 9.5, 9.8_

  - [x] 2.3 生成・整形の純粋関数を作る
    - `utils/initialPassword.ts`（`node:crypto` の `randomInt`、14 文字、英字と数字を各 1 文字以上）
    - `utils/logDetail.ts`（`buildLogDetail`。秘密情報を示すキー名を拒否、2,000 文字超は例外）
    - `utils/format.ts`（未設定表示、表示範囲の文言）
    - _Requirements: 3.1, 4.3, 6.8, 14.6_

  - [x] 2.4 一覧クエリと作成入力の検証を作る
    - `utils/listQuery.ts`（`parseUserListQuery`、`parseTeamListQuery`、`pageRange`、`PAGE_SIZE = 50`、検索語 1〜100 文字）
    - `types/userSchema.ts`（Zod 4。全項目のエラーを同時に集める。電話番号、列挙、実在する生年月日、未来日の拒否、Gran_Level）
    - _Requirements: 2.3, 2.4, 2.10, 4.9, 4.10, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.19, 11.3_

  - [ ]* 2.5 Property 6 のプロパティテストを書く
    - **Property 6: 検索語の長さ検証**
    - **Validates: Requirements 2.4, 2.10, 11.3**

  - [ ]* 2.6 Property 9 のプロパティテストを書く
    - **Property 9: 作成入力の検証は違反した項目をすべて同時に報告する**
    - **Validates: Requirements 4.9, 4.10, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.19, 9.8**

  - [ ]* 2.7 Property 11 のプロパティテストを書く
    - **Property 11: Initial_Password の形式と一意性**
    - **Validates: Requirements 4.3, 6.8**

  - [ ]* 2.8 Property 15 と Property 16 のプロパティテストを書く（別テストとして）
    - **Property 15: 停止・再開の遷移表とデータ保持**（遷移表の部分）
    - **Property 16: 権限変更の計画**
    - **Validates: Requirements 7.7, 8.1, 8.4, 8.5, 8.6, 8.7, 8.8**

- [x] 3. リポジトリ層
  - [x] 3.1 `adminLogRepository` を作る
    - `insertLog`（`NOW_JST` を明示、`buildLogDetail` 経由）、`listLogsForTarget`（最新 20 件、操作者の `login_id` を JOIN）
    - _Requirements: 3.4, 14.1, 14.6_

  - [x] 3.2 `teamPageRepository` から `purgeTeamRows` を切り出す
    - トランザクション制御なしの `purgeTeamRows(teamId)` を作り、既存の `deleteTeamAsLeader` はそれを呼ぶ形にする。外部の挙動は変えず、既存テストが通ることを確認する
    - _Requirements: 13.4, 13.10_

  - [x] 3.3 `userAdminRepository` を作る
    - `listUsers`（固定の WHERE 断片、`LIKE ? ESCAPE '\'`、`password_hash` を選択しない）、`getUserDetail`、管理者用の採番つき `insertUser`、各種 UPDATE、`deleteUserCascade`、履歴参照・有効エントリー・最後の管理者・代表者の判定クエリ
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.11, 3.1, 3.2, 3.3, 4.2, 4.20, 7.6, 10.3, 10.4, 10.6, 10.8, 14.3_

  - [x] 3.4 `teamAdminRepository` を作る
    - `listTeams`、`getTeamDetail`、`removeMember`（招待の `CANCELLED` 化と `TEAM_INVITE` 通知の対応済み化を含む）、`disbandTeam`（`purgeTeamRows` と代表者の `role` の条件つき更新）、有効エントリーとエントリー割当の判定
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 12.1, 12.5, 12.6, 13.3, 13.4, 13.6_

  - [ ]* 3.5 Property 4 と Property 5 のプロパティテストを書く（別テストとして）
    - **Property 4: 一覧の並び順・ページング・範囲表示**
    - **Property 5: 絞り込みは全条件の論理積でモデルと一致する**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.1, 11.2, 11.3**

- [x] 4. サービス層
  - [x] 4.1 閲覧サービスを作る
    - `userQueryService`、`teamQueryService`。冒頭で `requireAdmin("accounts.manage")` を呼び、`AdminAccessError` を `UNAUTHENTICATED` / `FORBIDDEN` に変換する
    - _Requirements: 1.6, 1.7, 1.8, 2.1, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 11.6, 11.10_

  - [x] 4.2 `userAdminService` の作成・解除・再発行・停止・再開を実装する
    - 検証 → 認可 → `runInTransaction`（権限再評価、前提条件、更新、`revokeSessions`、ログ）の骨格に従う
    - 作成は Initial_Password を bcrypt でハッシュ化し、平文は応答にだけ返す。メール重複は `lower(email)` で確認する
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11, 4.18, 4.20, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.9_

  - [x] 4.3 `userAdminService` の権限変更・査定・削除を実装する
    - 権限変更は `roles.manage` を追加で検証し、`planRoleChange` を使う。査定は `confirmOutOfRange` を扱い、レンジ外で未確認なら DB を変更せず `needsConfirmation` を返す
    - 削除は確認テキストの完全一致、判定順（自己、代表者、有効エントリー、最後の管理者、ログ操作者、履歴参照）、関連テーブルの連鎖削除、`USER_DELETED` のログを同一トランザクションで行う
    - _Requirements: 1.9, 1.10, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.11, 14.3_

  - [x] 4.4 `teamAdminService` を実装する
    - 除名（代表者・非所属・エントリー割当の拒否、招待の更新、通知 1 件、ログ）と解散（チーム名の完全一致、有効エントリーの拒否、通知、`purgeTeamRows`、代表者の `role` の戻し、ログ、アイコンの削除と警告）
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9, 13.10_

  - [ ]* 4.5 Property 1 のプロパティテストを書く
    - **Property 1: 管理者以外はユーザー・チーム管理に触れない**
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**

  - [ ]* 4.6 Property 2 のプロパティテストを書く
    - **Property 2: 前提条件を満たさない操作は何も変更しない**
    - **Validates: Requirements 5.6, 7.5, 7.6, 7.7, 8.4, 8.5, 8.6, 8.7, 8.8, 10.2, 10.3, 10.4, 10.5, 10.6, 12.4, 12.5, 12.6, 13.2, 13.3, 14.3**

  - [ ]* 4.7 Property 3 のプロパティテストを書く
    - **Property 3: 失敗時は全体が巻き戻り、成功時はログがちょうど 1 件**
    - SQLite のトリガー（`RAISE(ABORT)`）で途中の書き込みを失敗させる
    - **Validates: Requirements 4.8, 4.18, 5.5, 5.7, 6.5, 6.6, 7.4, 7.9, 8.3, 8.9, 9.6, 9.9, 10.9, 10.11, 12.2, 12.7, 13.7, 13.9, 14.4, 14.5**

  - [ ]* 4.8 Property 7 のプロパティテストを書く
    - **Property 7: 秘密情報は閲覧結果・ログ・DB の平文に現れない**
    - **Validates: Requirements 2.11, 3.5, 4.4, 6.5, 14.6**

  - [ ]* 4.9 Property 8 のプロパティテストを書く
    - **Property 8: 詳細画面の集計はモデルと一致する**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 11.1, 11.6**

  - [ ]* 4.10 Property 10 のプロパティテストを書く
    - **Property 10: 作成したユーザーは入力と採番規則どおりに保存される**
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.20**

  - [ ]* 4.11 Property 14 のプロパティテストを書く
    - **Property 14: パスワード再発行の効果**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 4.12 Property 12 のプロパティテストを書く
    - **Property 12: ロック状態の判定と解除**
    - 解除後に既存の `isLocked` がロックを理由に拒否しないことも確認する
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.8**

  - [ ]* 4.13 Property 17 のプロパティテストを書く
    - **Property 17: 初期レベル査定**
    - **Validates: Requirements 4.5, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8**

  - [ ]* 4.14 Property 18 のプロパティテストを書く
    - **Property 18: 削除は確認テキストの完全一致が必要で、関連データを連鎖して消す**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6, 10.8, 10.9, 14.3**

  - [ ]* 4.15 Property 19 のプロパティテストを書く
    - **Property 19: メンバー除名の効果**
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [ ]* 4.16 Property 20 のプロパティテストを書く
    - **Property 20: チーム解散の効果**
    - **Validates: Requirements 13.1, 13.4, 13.5, 13.6, 13.7, 13.10**

- [x] 5. Checkpoint - サービス層までの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Route Handler
  - [x] 6.1 ユーザー系 Route Handler を作る
    - `src/app/api/admin/users`（`POST` 作成）、`[id]/unlock`、`[id]/reset-password`、`[id]/suspend`、`[id]/reactivate`、`[id]/role`、`[id]/calibrate`、`[id]`（`DELETE`）
    - `id` が UUID でなければ `NOT_FOUND`、本文が JSON オブジェクトでなければ `VALIDATION`。結果は `httpResult` で変換する
    - _Requirements: 1.6, 1.7, 1.8, 4.4, 5.4, 6.1, 6.4, 7.1, 7.3, 8.1, 9.4, 10.1_

  - [x] 6.2 チーム系 Route Handler を作る
    - `src/app/api/admin/teams/[id]`（`DELETE` 解散）、`[id]/members/[userId]`（`DELETE` 除名）
    - _Requirements: 12.1, 13.1_

- [x] 7. 画面
  - [x] 7.1 共通 UI 部品を作る
    - `OperationDialog`（対象名・操作種別・確定/取り消し、実行中の確定ボタン無効化、1 回だけの `fetch`、30 秒の `AbortController`、確認テキスト入力と `fieldErrors.confirm` 表示、`code` ごとの日本語エラー、成功時の閉じる・トースト・`router.refresh()`）
    - `InitialPasswordNotice`（コピー用ボタン、state にのみ保持）
    - ユーザー/チームのタブ部品。ボタンは高さ・幅とも 44px 以上
    - _Requirements: 4.4, 6.4, 10.2, 13.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [x] 7.2 ユーザー一覧画面を作る
    - `/admin/users/page.tsx`（`requireAdminPage("accounts.manage")`）、`UserTable`、`UserFilters`。ページ送り、表示範囲、0 件メッセージと条件解除、検索語エラー、ロック中・停止中のテキスト表示、`tabular-nums`
    - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.2, 2.3, 2.9, 2.10, 2.12, 2.13, 5.1, 5.2, 7.8, 9.2_

  - [x] 7.3 ユーザー詳細画面を作る
    - `/admin/users/[id]/page.tsx`、`UserDetailView`。各項目と「未設定」表示、所属チーム、有効エントリー数、操作履歴、各操作ボタン（ロック解除、再発行、停止/再開、権限変更、削除）を `OperationDialog` で接続する。存在しない ID は `notFound()`、取得エラーは部分表示をしない
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 5.1, 5.2, 5.3, 6.4, 6.7, 7.8, 8.1, 10.1, 10.2, 11.8_

  - [x] 7.4 アカウント作成画面を作る
    - `/admin/users/new/page.tsx`、`CreateUserForm`。必須表示、項目ごとのエラー、入力値の保持、成功時の Initial_Password 表示（1 回のみ）
    - _Requirements: 4.1, 4.4, 4.9, 4.17, 4.18, 4.20_

  - [x] 7.5 初期レベル査定画面を作る
    - `/admin/users/[id]/calibrate/page.tsx`、`CalibrateForm`。申告階級・現在値・レンジ表示、レンジ外の警告と再確定（入力値が変わった場合は再確定扱いにしない）、エラー表示と入力値保持
    - _Requirements: 9.3, 9.4, 9.5, 9.7, 9.8_

  - [x] 7.6 チーム一覧画面を作る
    - `/admin/teams/page.tsx`、`TeamTable`。検索、ページ送り、0 件メッセージと検索語の保持
    - _Requirements: 1.1, 1.4, 1.5, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.7 チーム詳細画面を作る
    - `/admin/teams/[id]/page.tsx`、`TeamDetailView`。メンバー、有効エントリー、保留中の招待、各一覧の空表示、アイコンの代替表示、メンバー名からユーザー詳細へのリンク、除名と解散のダイアログ（解散成功でチーム一覧へ遷移）
    - _Requirements: 11.6, 11.7, 11.9, 11.10, 12.1, 13.1, 13.2, 13.8_

  - [x] 7.8 サイドバー項目を有効にする
    - `navConfig.ts` の `users-teams` を `implemented: true` にし、`navConfig.test.ts` に ADMIN にのみ表示される確認を追加する
    - _Requirements: 1.2, 1.3_

  - [ ]* 7.9 コンポーネントテストを書く
    - 確認ダイアログ（取り消しで呼ばれない、確定で 1 回、実行中は無効、30 秒で失敗扱い。fake timers）、ページの権限（未ログイン、`USER` / `LEADER` / `OPERATOR` で 404）、存在しない ID の 404、Initial_Password が再読み込みで再表示されないこと
    - _Requirements: 1.4, 1.5, 3.6, 4.4, 11.10, 15.2, 15.3, 15.4, 15.5, 15.8_

- [x] 8. ドキュメント更新
  - [x] 8.1 `docs/db-schema.md` を更新する
    - ER 図、`users.session_version`（3.1）、新規 `3.13 admin_account_logs`、インデックスの説明を追記する
    - _Requirements: 14.8_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きのサブタスクは任意で、MVP を優先する場合はスキップできる
- 各タスクは要件の項番を参照している
- プロパティテストは `Feature: user-team-management, Property {番号}: {名前}` のコメントを付け、`numRuns` は 100 以上にする
- 要確認事項（design.md 末尾）のうち、履歴のあるユーザーは削除不可（`HAS_HISTORY`）とする方針で実装する
- このワークフローは計画の作成のみで、実装は含まない。tasks.md を開き、各タスクの「Start task」から実行できる

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "2.1", "2.2", "2.3", "2.4", "7.8", "8.1"] },
    { "id": 1, "tasks": ["1.2", "1.5", "2.5", "2.6", "2.7", "2.8", "3.1", "3.2", "7.1"] },
    { "id": 2, "tasks": ["1.4", "3.3", "3.4"] },
    { "id": 3, "tasks": ["3.5", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.4", "4.8", "4.9", "7.2", "7.6"] },
    { "id": 5, "tasks": ["4.3", "4.15", "4.16", "6.2"] },
    { "id": 6, "tasks": ["4.5", "4.6", "4.7", "4.10", "4.11", "4.12", "4.13", "4.14", "6.1", "7.7"] },
    { "id": 7, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 8, "tasks": ["7.9"] }
  ]
}
```
