# Implementation Plan: admin-tournament-management

## Overview

管理コンソールに大会管理（一覧・登録・一括登録・編集・コピー・削除・ステータス変更・中止・エントリー状況・入金更新）を追加する。実装言語は TypeScript（Next.js、SQLite、vitest、fast-check）。

進め方は次のとおり。(1) スキーマと権限の土台、(2) 純粋関数と検証スキーマ、(3) 画像処理、(4) 大会の登録・更新・削除などのサービス、(5) ステータス変更と中止、(6) エントリー状況と入金更新、(7) Route Handler、(8) UI、(9) ドキュメント更新の順に積み上げ、最後に画面と API を結線する。

## Tasks

- [x] 1. スキーマと権限の土台を整える
  - [x] 1.1 `src/lib/db.ts` のスキーマを拡張する
    - `ensureColumn` で `tournaments.prize`、`entries.payment_status`（CHECK 付き、既定 `UNPAID`）、`entries.paid_at` を追加する
    - `entry_payment_logs` テーブルと 2 つのインデックス（`idx_entry_payment_logs_entry`、`idx_entries_tournament_payment`）を作成する
    - `notification_logs` の `delivery_type` CHECK に `TOURNAMENT_CANCELLED` を追加するため、`sqlite_master.sql` を確認し未対応の場合のみトランザクション内で「改名→再作成→全列コピー→旧テーブル削除」を行う
    - `applySchema` を `export` する
    - _Requirements: 13.9, 13.10, 13.11, 13.13, 13.14, 13.15, 13.16, 13.17, 13.19_

  - [x] 1.2 権限・ナビ・通知リポジトリを拡張する
    - `types/permissions.ts` に `entries.manage` を追加し、`utils/permissions.ts` の `ROLE_PERMISSIONS.ADMIN` のみに付与する
    - `navConfig.ts` の `tournaments` を `implemented: true` にする
    - `notificationRepository` の `NotificationType` に `TOURNAMENT_CANCELLED` を追加し、`logNotification` に任意引数 `status`（既定 `SUCCESS`）と `errorMessage` を追加する
    - _Requirements: 1.2, 15.1_

  - [ ]* 1.3 マイグレーションのプロパティテストを書く
    - **Property 22: マイグレーションの保全と冪等性**
    - 旧スキーマの `:memory:` DB に任意の行を作り `applySchema` を複数回実行する。片方の列のみ存在するケースと `notification_logs` の既存行保持も確認する
    - **Validates: Requirements 13.9, 13.10, 13.11, 13.13, 13.14, 13.15, 13.16, 13.19**

  - [ ]* 1.4 権限とナビの単体テストを書く
    - `permissions.test.ts` に `entries.manage` が ADMIN のみであることを追加する
    - `navConfig.test.ts` に `tournaments` が有効で ADMIN・OPERATOR に表示されることを追加する
    - _Requirements: 1.2, 15.1_

- [x] 2. 型・検証スキーマ・純粋関数を実装する
  - [x] 2.1 型定義を作成する
    - `types/adminTournament.ts`（`AdminTournament`、`TournamentInput`、`FieldErrors`、`ServiceResult`、`ErrorCode`、`PaymentStatus`、一覧行・統計の型）
    - `types/entryStatus.ts`（エントリー状況の DTO。個人情報は氏名・読み仮名のみ）
    - _Requirements: 3.1, 14.8, 14.25_

  - [x] 2.2 ステータス遷移と入金遷移の純粋関数を実装する
    - `utils/statusTransitions.ts`（`ALLOWED_STATUS_TRANSITIONS`、`allowedNextStatuses`、`canTransition`、`missingRequiredFields`）
    - `utils/paymentTransitions.ts`（`ALLOWED_PAYMENT_TRANSITIONS`、`planPaymentUpdate`、`allowedPaymentActions`）
    - _Requirements: 6.2, 6.3, 6.4, 6.7, 15.7, 15.8, 15.15, 15.16, 15.17, 15.18, 15.19, 15.30_

  - [ ]* 2.3 ステータス遷移のプロパティテストを書く
    - **Property 11: ステータス遷移表**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.4**

  - [ ]* 2.4 入金遷移のプロパティテストを書く
    - **Property 23: 入金遷移表とガード**
    - **Validates: Requirements 15.7, 15.8, 15.15, 15.16, 15.17, 15.18, 15.19, 15.30**

  - [x] 2.5 管理者用 Zod スキーマ `types/adminSchema.ts` を実装する
    - 必須・列挙・範囲・文字数・クロスフィールド検証（`superRefine`）、日時の正規化、`emptyToNull`、団体戦の `genderDivision` 補完、全項目エラーの同時返却と平坦化
    - 更新用（`expectedUpdatedAt`）、登録用（`copyFromId`）、一括用（`common` と `rows` 1〜50 件）のスキーマ
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 3.19, 3.20, 3.21, 9.3, 9.4, 13.1_

  - [ ]* 2.6 入力検証のプロパティテストを書く
    - **Property 5: 入力検証は違反した項目をすべて同時に報告する**
    - **Validates: Requirements 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 3.19, 3.21, 5.4, 8.8, 9.6, 13.1**

  - [x] 2.7 一覧・集計・一括・コピー・画像 URL・ページングの純粋関数を実装する
    - `utils/listFilter.ts`（`sortTournaments`、`filterTournaments`、`validateDateRange`）
    - `utils/alerts.ts`（`formatCapacityRatio`、`totalEntryFee`、`isDraftOverdue`、`isUnderCapacityAlert`、`needsFeeConfirmation`。月末は前月末日へ丸める）
    - `utils/bulk.ts`（`expandBulk`、`findDuplicateRows`）、`utils/copyDefaults.ts`（`buildCopyDefaults`）
    - `utils/adminImageUrl.ts`（`toImageUrl`、`parseImageKey`）、`utils/pagination.ts`（20 件ページング。既存の `data/utils/pagination.ts` が使えれば再利用）
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.6, 8.2, 8.3, 9.9, 11.2, 11.5, 11.6, 11.7, 14.21_

  - [ ]* 2.8 一覧の並び順と絞り込みのプロパティテストを書く
    - **Property 2: 一覧の並び順**
    - **Property 3: 一覧の絞り込みは全条件の論理積**
    - **Property 4: 不正な期間の検出**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

  - [ ]* 2.9 警告判定と集計の純粋関数のプロパティテストを書く
    - **Property 21（純粋関数部分）: 詳細画面の統計と警告**（`formatCapacityRatio`、`totalEntryFee`、`isDraftOverdue`、`isUnderCapacityAlert`）
    - **Property 10（c）: 参加費確認の要否**（`needsFeeConfirmation`）
    - **Validates: Requirements 5.6, 11.2, 11.5, 11.6, 11.7**

- [x] 3. 要項画像の処理を実装する
  - [x] 3.1 `server/imageProcessor.ts` に `processTournamentImage` を実装する
    - 先頭バイトで PNG・JPEG・WebP を判定し、5,242,880 バイト以下を `sharp` で WebP 変換する。形式違反は 415、サイズ超過は 413
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 3.2 画像検証のプロパティテストを書く
    - **Property 16: 要項画像の検証**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 4. 大会の登録・更新・コピー・一括登録・削除を実装する
  - [x] 4.1 `server/tournamentAdminRepository.ts` を実装する
    - 大会の SELECT / INSERT / UPDATE / DELETE（バインド変数のみ、`updated_at` による楽観ロック）、一覧行（確定数は `CONFIRMED_ENTRY_SQL` に集約）、一括 INSERT のトランザクション、参照・エントリー有無の確認
    - _Requirements: 2.1, 3.2, 3.3, 3.4, 5.2, 5.10, 10.3, 13.2, 13.6, 13.8_

  - [x] 4.2 `server/tournamentForm.ts` と `server/tournamentAdminService.ts`（登録・更新）を実装する
    - multipart の取り出し、`Deps`（`storage`、`sender`、`now`）の注入、`createTournament`、`updateTournament`
    - 画像の保存順序（検証→保存→トランザクション→旧画像削除）と失敗時の後始末、定員が確定数を下回る更新・固定項目の変更・楽観ロックの拒否
    - _Requirements: 3.2, 3.5, 3.22, 4.2, 4.5, 4.6, 4.8, 5.2, 5.5, 5.8, 5.10, 13.1, 13.4, 13.8_

  - [ ]* 4.3 保存・失敗・冪等性のプロパティテストを書く
    - **Property 6: 保存と読み出しの往復**
    - **Property 7: 失敗した書き込みは何も変更しない**（SQLite トリガーで DB エラーを注入）
    - **Property 8: 同一内容の編集は冪等**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.20, 3.22, 4.7, 9.8, 13.2, 13.3, 13.4, 13.5, 13.6, 13.8**

  - [ ]* 4.4 楽観ロック・更新制約・画像整合のプロパティテストを書く
    - **Property 9: 楽観ロック**（編集側）
    - **Property 10（a）（b）: 定員・固定項目の制約**
    - **Property 17: 画像ストレージと DB の整合**（インメモリ `ImageStorage` で失敗を注入）
    - **Validates: Requirements 4.5, 4.6, 4.8, 5.5, 5.8, 5.10**

  - [x] 4.5 コピー・一括登録・削除をサービスに追加する
    - `createTournament` の `copyFromId` 対応（画像の複製、`copy_from_id` の設定、`draw_pdf_url` は `NULL`）
    - `previewBulk`、`createBulk`（重複・行番号つきエラー、全件 1 トランザクション、大会ごとに別画像キー）
    - `deleteTournament`（`DRAFT`・エントリー 0 件・未参照のときのみ。DB 削除後に画像を削除し、失敗は `imageWarning`）
    - _Requirements: 8.1, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9.1, 9.2, 9.5, 9.7, 9.8, 9.9, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ]* 4.6 コピー・一括・削除のプロパティテストを書く
    - **Property 18: コピー初期値と保存結果**
    - **Property 19: 一括登録**
    - **Property 20: 削除の前提条件**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.9, 10.3, 10.4, 10.5, 10.6**

- [x] 5. ステータス変更と中止を実装する
  - [x] 5.1 `changeStatus` と `getCancelImpact` をサービスに追加する
    - 遷移検証、`OPEN` の必須項目検証、`status` と `updated_at` による楽観ロック、成功後の `revalidatePath("/tournaments")` と `/home`
    - 中止時は同一トランザクションで大会・キャンセル待ち（`EXPIRED`）・請求中キャンセル（`WAIVED` と `admin_notes` 追記）を更新し、コミット後に `CONFIRMED` の代表者へ通知して `notification_logs` に 1 件ずつ記録する。通知失敗でもステータスは維持し `{ total, failed }` を返す。`payment_status` と `paid_at` には触れない
    - 4 件数（確定数、待ち数、請求中数、入金済み数）の取得
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.14_

  - [x] 5.2 `submitWaitlistAction` に大会ステータス検証を追加する
    - `src/features/entries/server/actions.ts` で `CANCELLED` と `DRAFT` の大会へのキャンセル待ち登録を拒否する
    - _Requirements: 7.12, 6.9_

  - [ ]* 5.3 ステータス変更・中止のプロパティテストを書く
    - **Property 9: 楽観ロック**（ステータス変更側）
    - **Property 12: OPEN への変更には必須項目がすべて必要**
    - **Property 13: 未公開の大会はユーザー向けに出ない**
    - **Property 14: 中止の連鎖更新と件数**
    - **Property 15: 中止時の原子性と通知**（`NotificationSender` と SQLite トリガーで失敗を注入）
    - **Validates: Requirements 6.6, 6.7, 6.9, 7.1, 7.3, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.14**

  - [ ]* 5.4 キャンセル待ち登録の拒否の単体テストを書く
    - `CANCELLED` / `DRAFT` の大会で拒否されることを確認する
    - _Requirements: 7.12_

- [x] 6. エントリー状況・統計・入金更新を実装する
  - [x] 6.1 `server/entryStatusRepository.ts` と `server/entryStatusService.ts` を実装する
    - 件数（状況別・入金別、絞り込み非依存、0 補完）、エントリー・キャンセル待ち・キャンセルの各一覧（バインド変数、`LIKE` のエスケープ、20 件ページング、並び順）
    - 取得列は氏名・読み仮名・チーム名に限定。サービス先頭で `requireAdmin("entries.view")`。4 部分を個別 `try/catch` で部分失敗に対応。キーワード 100 文字超は検証エラー
    - _Requirements: 14.5, 14.7, 14.8, 14.13, 14.14, 14.15, 14.16, 14.17, 14.18, 14.19, 14.20, 14.21, 14.25, 14.26, 14.27, 14.28, 14.30, 14.32, 14.33, 14.36_

  - [ ]* 6.2 エントリー状況のプロパティテストを書く
    - **Property 25: エントリー状況の絞り込み**
    - **Property 26: エントリー状況の並び順とページング**
    - **Property 27: 状況別件数は絞り込みの影響を受けない**
    - **Property 28: 個人情報の除外**
    - **Validates: Requirements 14.7, 14.13, 14.14, 14.15, 14.16, 14.17, 14.19, 14.20, 14.21, 14.22, 14.25, 14.29, 14.30, 14.32, 14.33, 14.36**

  - [x] 6.3 `server/paymentRepository.ts` と `server/paymentService.ts` を実装する
    - `updatePayment`: `BEGIN` → 大会に属するエントリーの取得 → `planPaymentUpdate` → `UPDATE ... WHERE payment_status = ?`（`paid_at` の設定・消去・保持）→ `entry_payment_logs` への 1 件追加 → `COMMIT`。失敗時は `ROLLBACK`
    - `NOOP` は `ALREADY_UPDATED`、対象なしは `NOT_FOUND`
    - _Requirements: 13.21, 15.4, 15.9, 15.10, 15.11, 15.12, 15.18, 15.19, 15.20, 15.21, 15.22, 15.23, 15.28, 15.29, 15.30, 15.31_

  - [ ]* 6.4 入金更新のプロパティテストを書く
    - **Property 24: 入金更新の効果・冪等性・ログ**（SQLite トリガーで途中失敗を注入）
    - **Validates: Requirements 13.21, 15.9, 15.10, 15.11, 15.20, 15.21, 15.22, 15.23, 15.28, 15.29**

  - [x] 6.5 大会詳細の統計取得を `tournamentAdminRepository` に追加する
    - 確定数、`WAITING` 件数、請求中キャンセル件数、入金済み・未入金件数（`CONFIRMED`/`ATTENDED`）を個別クエリで取得し、項目ごとに失敗を許容する
    - _Requirements: 11.3, 11.4, 11.8, 11.10, 11.11, 11.13_

  - [ ]* 6.6 詳細統計のプロパティテストを書く
    - **Property 21（DB 部分）: 詳細画面の統計**（定義どおりの行数との一致、入金更新後の再取得）
    - **Validates: Requirements 11.3, 11.4, 11.10, 11.11, 11.13**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Route Handler を実装する
  - [x] 8.1 大会の書き込み API を実装する
    - `src/app/api/admin/tournaments/route.ts`（POST 登録・コピー）、`bulk/route.ts`（POST、`dryRun` 対応）、`[id]/route.ts`（PATCH、DELETE）、`[id]/status/route.ts`（POST）、`[id]/cancel-impact/route.ts`（GET）
    - すべて `withAdminApi("tournaments.manage", ...)`。`ErrorCode` を HTTP ステータスへ変換し、応答は `{ ok, message, fieldErrors }` 形式。例外の詳細は返さない
    - _Requirements: 1.7, 1.8, 1.9, 3.5, 4.3, 4.4, 5.9, 6.5, 7.1_

  - [x] 8.2 入金更新 API と画像配信 API を実装する
    - `[id]/entries/[entryId]/payment/route.ts`（`withAdminApi("entries.manage", ...)`、1 リクエスト 1 エントリー、JSON `{ to, expectedFrom }`、`ALREADY_UPDATED` は 200 + `alreadyUpdated`）
    - `src/app/api/tournaments/image/[key]/route.ts`（ログイン必須、`parseImageKey` に一致するキーのみ、`nosniff`、`private` キャッシュ）
    - _Requirements: 4.2, 15.4, 15.5, 15.6, 15.19, 15.31_

  - [ ]* 8.3 権限のプロパティテストを書く
    - **Property 1: 権限判定と書き込みの拒否**
    - `getSession` と `findUserById` をモックし、各 Route Handler で ロール×権限 の行列、未ログイン（401）、権限不足（403）、DB スナップショット不変を確認する
    - **Validates: Requirements 1.7, 1.8, 1.9, 14.26, 14.27, 15.1, 15.4, 15.5, 15.6**

- [x] 9. 画面を実装して結線する
  - [x] 9.1 共通部品 `src/components/ui/ConfirmDialog.tsx` を作成する
    - `role="dialog"`、フォーカス移動、Esc で閉じる、44px 以上のボタン、同期的な `busy` による二重送信防止
    - _Requirements: 5.6, 5.7, 7.2, 10.2, 12.1, 12.9, 15.13, 15.14, 15.27_

  - [x] 9.2 一覧ページを実装する
    - `(admin)/admin/tournaments/page.tsx`（`requireAdminPage("entries.view")`）と `TournamentListView`（クライアント側の絞り込み・並び替え、768px 未満はカード、以上は表、0 件メッセージ、期間エラー時は直前の一覧を保持）
    - OPERATOR には操作要素を出さない
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 12.6, 12.7_

  - [x] 9.3 登録・コピー・編集ページと `TournamentForm` を実装する
    - `new/page.tsx`（`?copyFrom={id}`、元が無ければ `notFound()`、管理対象外画像は画像欄を空にする）、`[id]/edit/page.tsx`、共通の `TournamentForm`（必須表示、項目別エラー、入力値保持、画像プレビュー、参加費変更時の確認ダイアログ、トースト、`busy`）
    - _Requirements: 3.1, 3.5, 3.21, 4.1, 5.1, 5.3, 5.6, 5.7, 8.1, 8.2, 8.3, 8.9, 12.8, 12.9, 12.11_

  - [x] 9.4 一括登録ページを実装する
    - `bulk/page.tsx` と `BulkRegistrationForm`（共通項目、（開催日、種目区分）の行編集、`dryRun` によるプレビュー、確定、行番号つきエラー表示）
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.7, 9.9_

  - [x] 9.5 詳細ページと操作部品を実装する
    - `[id]/page.tsx`（`TournamentDetailView`: 全項目、統計の部分失敗表示、警告、エントリー状況へのリンク、入金件数）、`StatusChangeControl`（許可された遷移先のみ）、`CancelConfirmDialog`（4 件数と入金済み注意文）、`DeleteConfirmDialog`（大会名表示）、コピー作成リンク。入金更新の操作要素は置かない
    - 表示は React のエスケープに任せ `dangerouslySetInnerHTML` を使わない
    - _Requirements: 6.1, 6.4, 7.1, 7.2, 7.10, 7.13, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 13.7_

  - [x] 9.6 エントリー状況ページを実装する
    - `[id]/entries/page.tsx` と `EntryStatusView`（件数、フィルタを URL searchParams に反映、3 つの一覧とページャ、チーム未設定・代理登録・入金状況の表示、部分失敗の再読み込み）、`PaymentUpdateControl`（`entries.manage` を持つときのみ。確認ダイアログ→API→トースト→`router.refresh()`、絞り込みとページの保持）
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.8, 14.9, 14.10, 14.11, 14.12, 14.18, 14.22, 14.23, 14.24, 14.28, 14.34, 14.35, 15.2, 15.3, 15.13, 15.14, 15.24, 15.25, 15.26, 15.27_

  - [ ]* 9.7 UI の例ベーステストと静的チェックを書く
    - 0 件メッセージ、チーム未設定、代理登録、入金ラベル、OPERATOR に操作要素が無いこと、確認ダイアログのキャンセルでデータが変わらないこと、`<script>` を含む文字列が文字として表示されること
    - 本機能のソースに絵文字と `dangerouslySetInnerHTML` が無いこと、要項画像の登録から配信までの統合テスト、`OPEN` 変更後にユーザー向け一覧へ表示されること
    - _Requirements: 2.8, 6.8, 7.2, 7.13, 12.5, 13.7, 14.9, 14.12, 14.23, 14.24, 15.3, 15.14_

- [x] 10. ドキュメントを更新する
  - [x] 10.1 `docs/db-schema.md` を更新する
    - ER 図、`tournaments.prize`、`entries.payment_status` / `paid_at`、`entry_payment_logs` の新規定義、追加列の説明、`notification_logs.delivery_type` への `TOURNAMENT_CANCELLED` を反映する
    - _Requirements: 13.12, 13.18, 13.20_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` のついたタスクは任意（テスト関連）で、MVP では省略できる
- 各タスクは要件番号で追跡できる
- チェックポイントで段階的に検証する
- プロパティテストは普遍的な性質、単体テストは具体例とエッジケースを検証する
- 確定エントリー数は要件どおり `CONFIRMED` のみ。ユーザー向け画面（`CONFIRMED` と `ATTENDED`）とずれるため、`CONFIRMED_ENTRY_SQL` に集約し、将来 1 か所で切り替えられるようにする
- UI の寸法・コントラスト・表示時間（Requirement 12 の大半、1.3、4.1、14.2、14.31、15.24）は自動化せず、ライト・ダーク両モードで手動確認する

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.2", "2.5", "2.7", "3.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.6", "2.8", "2.9", "3.2", "4.1", "9.1"] },
    { "id": 3, "tasks": ["4.2", "10.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "5.2", "6.1", "6.3"] },
    { "id": 5, "tasks": ["4.6", "5.1", "5.4", "6.2", "6.4", "6.5"] },
    { "id": 6, "tasks": ["5.3", "6.6", "8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3", "9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 8, "tasks": ["9.7"] }
  ]
}
```
