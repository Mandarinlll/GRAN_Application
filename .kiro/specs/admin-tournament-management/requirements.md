# Requirements Document

## Introduction

管理コンソール（`/admin`）に「大会管理」機能を追加する。対象は `docs/requirements-detail-administrator.md` の 2.1（大会新規登録・一括登録・編集 A-07/A-08）、2.2（大会ステータス管理 A-03）、2.3（過去大会コピー作成 A-09）である。

現行リポジトリでは、サイドバー項目 `/admin/tournaments`（`src/features/admin/utils/navConfig.ts`）が `implemented: false` であり、画面が存在しない。権限は `src/features/admin/utils/permissions.ts` の定義に従い、`tournaments.manage`（ADMIN のみ）で登録・編集・料金変更・ステータス変更を許可し、`entries.view`（ADMIN と OPERATOR）で閲覧を許可する。データは `src/lib/db.ts` の `tournaments` テーブル（SQLite、日時は JST 文字列）を使用する。UI は `docs/ui-design-system.md` に従う。

本機能の範囲には、`tournaments` テーブルへ `prize` 列（TEXT、NULL 許容）を追加するスキーマ変更とマイグレーション（既存データを損なわない）を含める。マイグレーションは `src/lib/db.ts` の `ensureColumn` による冪等な列追加で適用し、あわせて `docs/db-schema.md` の `tournaments` 定義（ER 図、列定義、追加列の説明）を更新する。

本機能の範囲には、`entries` テーブルへ入金状況列 `payment_status`（TEXT、NOT NULL、既定値 `UNPAID`、取りうる値 `UNPAID` / `PAID` / `REFUNDED`）と入金日時列 `paid_at`（TEXT、NULL 許容、JST 文字列）を追加するスキーマ変更とマイグレーションも含める。`prize` 列と同様に `ensureColumn` による冪等な列追加で適用し、既存行は未入金相当の既定値（`UNPAID`、`paid_at` は NULL）とし、既存データを損なわない。あわせて `docs/db-schema.md` の `entries` 定義（ER 図、列定義、追加列の説明）を更新する。

本機能には、大会ごとのエントリー状況（エントリー・キャンセル待ち・キャンセル）を詳細に確認する画面（Requirement 14）を含める。エントリー・キャンセル待ち・キャンセルのデータは閲覧専用とし、入金状況のみ例外として、Admin_User がエントリー状況画面の各エントリー行から更新できる（Requirement 15）。入金状況の更新は新しい権限 `entries.manage`（ADMIN のみ）で制御し、`src/features/admin/utils/permissions.ts` の `ROLE_PERMISSIONS` の ADMIN にのみ追加する。Operator_User は入金状況を閲覧のみ可能とする。大会詳細画面は入金状況の閲覧のみとする。

入金状況の変更履歴の記録のため、`src/lib/db.ts` には監査ログ用の既存テーブルが存在しないので、`entry_payment_logs` テーブルを `CREATE TABLE IF NOT EXISTS` で新設する（Requirement 13、15）。あわせて `docs/db-schema.md` を更新する。

対象外: 返金処理自体（返金の金銭的な実行。`REFUNDED` への記録のみ範囲に含む）、複数エントリーの入金状況の一括更新、ドロー表作成（2.4）、結果入力、GRANレベル変動、エントリー代理登録、キャンセル待ち管理（状態の変更操作）、一斉メール配信の本体、エントリー状況の CSV 出力、`tournaments` テーブルへの `min_gran_level` / `max_gran_level` 追加（将来拡張）。

## Glossary

- **Admin_Console**: `/admin` 配下の管理コンソール Web 画面群
- **Tournament_Manager**: 管理コンソール内で大会の一覧表示・登録・編集・ステータス変更・コピーを行う機能
- **Tournament**: `tournaments` テーブルの 1 レコードで表す大会
- **Admin_User**: `users.role` が `ADMIN` のログインユーザー（`tournaments.manage` 権限を持つ）
- **Operator_User**: `users.role` が `OPERATOR` のログインユーザー（`entries.view` 権限を持ち、`tournaments.manage` 権限と `entries.manage` 権限を持たない）
- **Tournament_Status**: `tournaments.status` の値。`DRAFT`（未公開）、`UPCOMING`（受付前）、`OPEN`（受付中）、`CLOSED`（締切）、`FINISHED`（開催終了）、`CANCELLED`（中止）
- **Required_Fields**: 大会名（`title`）、開催日（`event_date`）、種目区分（`category`）、募集階級（`tier`）、会場名（`venue`）、要項画像（`image_url`）、定員数（`capacity`）、参加費（`entry_fee`）、開始時刻（`start_time`）、受付開始日時（`entry_start_at`）、受付締切日時（`entry_end_at`）
- **Optional_Fields**: 要項詳細説明（`description`）、終了時刻（`end_time`）、景品（`prize`）、コート情報（`court_info`）、チーム人数の最小・最大（`team_size_min` / `team_size_max`）、1ヶ月前アラート閾値（`alert_threshold`）、サーフェス（`surface`）、大会シリーズ（`series_id`）、部門の性別区分（`gender_division`）
- **Prize**: `tournaments.prize`（TEXT、NULL 許容）に保存する景品の説明文。最大 200 文字
- **Entry_Status**: `entries.status` の値。`CONFIRMED`（確定）、`WAITING`（キャンセル待ち）、`CANCELLED`（キャンセル）、`ATTENDED`（出席済）
- **Entry_Status_Viewer**: 大会別エントリー状況画面（Requirement 14）で、大会のエントリー・キャンセル待ち・キャンセルを閲覧する機能
- **Entry_Representative**: エントリーの代表者。`entries.user_id` が指す `users` の `real_name` で表す
- **Entry_Team_Name**: `entries.team_id` が指す `teams.name`。`team_id` が NULL のエントリー（個人戦など）は未設定として扱う
- **Payment_Status**: エントリーの入金状況。`entries.payment_status` の値で表す。`UNPAID`（未入金）、`PAID`（入金済み）、`REFUNDED`（返金済み）のいずれかで、既定値は `UNPAID`。キャンセルの有償・無償（`cancellations.is_paid`）と `cancellations.admin_status` は Payment_Status とは別の情報として扱う
- **Paid_At**: `entries.paid_at`（TEXT、NULL 許容）に保存する入金日時（JST、`YYYY-MM-DD HH:mm:ss` 形式）。Payment_Updater が入金済みへの更新時に設定し、未入金への取り消し時に NULL へ戻す
- **Payment_Updater**: エントリー状況画面で Admin_User が Payment_Status を更新する機能（Requirement 15）
- **Payment_Transition**: Payment_Status の変更。許可される遷移は `UNPAID` から `PAID`、`PAID` から `UNPAID`（入金の取り消し）、`PAID` から `REFUNDED` の 3 種類のみ
- **Payment_Log**: 入金状況の変更履歴を記録する `entry_payment_logs` テーブルの 1 レコード。エントリー ID、変更前の Payment_Status、変更後の Payment_Status、変更した Admin_User の `users.id`、変更日時（JST）を持つ
- **entries.manage**: 入金状況の更新を許可する権限。ADMIN のみが持ち、OPERATOR は持たない
- **Paid_Entry**: `entries.payment_status` が `PAID` のエントリー
- **Unpaid_Entry**: `entries.payment_status` が `UNPAID` のエントリー
- **Payment_Migration**: `src/lib/db.ts` の `ensureColumn` により `entries` へ `payment_status` 列と `paid_at` 列を冪等に追加するデータベース初期化処理
- **Confirmed_Entry**: `entries.status` が `CONFIRMED` のエントリー
- **Waitlist**: `waitlists` テーブルのキャンセル待ちキュー
- **Paid_Cancellation**: `cancellations.is_paid = 1` かつ `admin_status` が `UNCONTACTED` または `IN_CONSULTATION` のキャンセル
- **Notification_Service**: 通知を生成し `notification_logs` に記録する既存のサーバー側機能
- **Image_Storage**: トピックス画像でも使用している、画像を保存し保存キーで配信する既存の仕組み

## Requirements

### Requirement 1: 大会管理画面へのアクセス制御

**User Story:** As an Admin_User または Operator_User, I want 大会管理画面に権限に応じてアクセスしたい, so that 権限のない操作が実行されない。

#### Acceptance Criteria

1. THE Admin_Console SHALL 大会管理画面を `/admin/tournaments` で提供する
2. THE Admin_Console SHALL サイドバーの「大会管理」項目を、`/admin/tournaments` へ遷移する有効なリンクとして Admin_User および Operator_User に表示する
3. WHEN Admin_User または Operator_User が `/admin/tournaments` を開く, THE Tournament_Manager SHALL 3 秒以内に大会一覧を表示する
4. WHEN 未ログインのユーザーが `/admin/tournaments` を開く, THE Admin_Console SHALL 大会一覧を表示せずにログイン画面へ遷移させる
5. WHEN `role` が `USER` または `LEADER` のユーザーが `/admin/tournaments` を開く, THE Admin_Console SHALL 大会一覧を表示せずに 404 応答を返す
6. WHERE ログインユーザーが Operator_User である, THE Tournament_Manager SHALL 大会一覧を閲覧可能な状態のまま、登録・編集・ステータス変更・コピー・削除の操作要素を表示しない
7. IF Operator_User が大会の登録・編集・ステータス変更・コピー・削除のサーバー処理を直接呼び出す, THEN THE Tournament_Manager SHALL 大会データを変更せずに、権限不足を示すエラーを呼び出し元へ返す
8. WHEN 大会の登録・編集・ステータス変更・コピー・削除のいずれかのサーバー処理が呼び出される, THE Tournament_Manager SHALL 処理の実行前に呼び出しユーザーが `tournaments.manage` 権限を持つかを検証する
9. IF 未ログインのユーザーが大会の登録・編集・ステータス変更・コピー・削除のサーバー処理を直接呼び出す, THEN THE Tournament_Manager SHALL 大会データを変更せずに、認証が必要であることを示すエラーを呼び出し元へ返す

### Requirement 2: 大会一覧の表示と絞り込み

**User Story:** As an Admin_User または Operator_User, I want 登録済みの大会を一覧で確認したい, so that 運営対象の大会をすばやく見つけられる。

#### Acceptance Criteria

1. WHEN 大会一覧画面が表示される, THE Tournament_Manager SHALL 各大会について、大会名、開催日、種目区分、募集階級、会場名、Tournament_Status、定員数、Confirmed_Entry 数を 1 行に表示する
2. WHEN 大会一覧画面が表示される, THE Tournament_Manager SHALL 大会を開催日の降順で表示し、開催日が同一の大会は大会名の昇順で表示する
3. WHEN ユーザーが Tournament_Status を選択する, THE Tournament_Manager SHALL 選択された Tournament_Status に一致する大会のみを表示する
4. WHEN ユーザーが大会名の一部（1 文字以上 100 文字以下）を入力する, THE Tournament_Manager SHALL 大会名に入力文字列を含む大会のみを、大文字小文字を区別せずに表示する
5. WHEN ユーザーが開催日の期間（開始日・終了日）を指定する, THE Tournament_Manager SHALL 開催日が開始日以上かつ終了日以下の大会のみを表示する
6. IF 開始日が終了日より後の日付で指定された, THEN THE Tournament_Manager SHALL 期間の指定が不正である旨のエラーメッセージを表示し、直前に表示していた一覧を変更しない
7. WHILE 複数の絞り込み条件（Tournament_Status、大会名、開催日の期間）が指定されている, THE Tournament_Manager SHALL すべての条件を満たす大会のみを表示する
8. IF 絞り込み条件に一致する大会が 0 件である, THEN THE Tournament_Manager SHALL 該当する大会がない旨のメッセージを表示し、指定中の絞り込み条件を保持する
9. WHEN 大会一覧の行が選択される, THE Tournament_Manager SHALL その大会の詳細画面を表示する
10. THE Tournament_Manager SHALL 一覧と詳細の日付・時刻・金額・件数の表示に `tabular-nums` を適用する

### Requirement 3: 大会の新規登録

**User Story:** As an Admin_User, I want 大会の開催要項を登録したい, so that ユーザーが大会に申し込める。

#### Acceptance Criteria

1. WHEN Admin_User が大会登録画面を開く, THE Tournament_Manager SHALL Required_Fields と Optional_Fields の入力欄を表示し、Required_Fields の各入力欄に必須であることを示す表示を付ける
2. WHEN Admin_User が Required_Fields をすべて有効な値で入力して登録を実行する, THE Tournament_Manager SHALL 新しい UUID を `tournaments.id` として採番し、Tournament を保存する
3. WHEN Admin_User が Tournament_Status を指定せずに登録を実行する, THE Tournament_Manager SHALL Tournament_Status を `DRAFT` として保存する
4. WHEN Tournament が保存される, THE Tournament_Manager SHALL `created_at` と `updated_at` に同一の JST の現在日時を設定する
5. WHEN Tournament の保存が成功する, THE Tournament_Manager SHALL 成功メッセージを表示し、保存した大会の詳細画面を表示する
6. IF Required_Fields のいずれかが未入力（空文字または空白のみを含む）である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、未入力の項目ごとに、その項目の入力欄の近くに未入力であることを示すエラーメッセージを表示する
7. IF 種目区分が `MEN_TEAM`、`WOMEN_TEAM`、`MIX_TEAM`、`SINGLES`、`DOUBLES` 以外である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、種目区分の入力欄に許可されていない値であることを示すエラーメッセージを表示する
8. IF 募集階級が `A`、`AB`、`B`、`BC`、`C`、`CD`、`D`、`DE` 以外である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、募集階級の入力欄に許可されていない値であることを示すエラーメッセージを表示する
9. IF 定員数が 1 以上 9,999 以下の整数でない, THEN THE Tournament_Manager SHALL Tournament を保存せずに、定員数の入力欄に有効範囲（1〜9,999 の整数）を示すエラーメッセージを表示する
10. IF 参加費が 0 以上 999,999 以下の整数でない, THEN THE Tournament_Manager SHALL Tournament を保存せずに、参加費の入力欄に有効範囲（0〜999,999 の整数）を示すエラーメッセージを表示する
11. IF 大会名が 100 文字を超える, THEN THE Tournament_Manager SHALL Tournament を保存せずに、大会名の入力欄に最大文字数（100 文字）を示すエラーメッセージを表示する
12. IF 終了時刻が入力され、かつ終了時刻が開始時刻以前である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、終了時刻の入力欄に開始時刻より後の時刻を指定する必要があることを示すエラーメッセージを表示する
13. IF 受付締切日時が受付開始日時以前である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、受付締切日時の入力欄に受付開始日時より後の日時を指定する必要があることを示すエラーメッセージを表示する
14. IF 受付締切日時が開催日の翌日 0 時 0 分（JST）以降である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、受付締切日時の入力欄に開催日の 23 時 59 分（JST）以前を指定する必要があることを示すエラーメッセージを表示する
15. IF `team_size_min` と `team_size_max` の両方が入力され、`team_size_min` が `team_size_max` を超える, THEN THE Tournament_Manager SHALL Tournament を保存せずに、`team_size_min` の入力欄に `team_size_max` 以下の値を指定する必要があることを示すエラーメッセージを表示する
16. IF `alert_threshold` が入力され、0 未満または定員数を超える, THEN THE Tournament_Manager SHALL Tournament を保存せずに、`alert_threshold` の入力欄に有効範囲（0 以上、定員数以下の整数）を示すエラーメッセージを表示する
17. IF `surface` が入力され、`HARD`、`CLAY`、`ARTIFICIAL_GRASS`、`OTHER` 以外である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、`surface` の入力欄に許可されていない値であることを示すエラーメッセージを表示する
18. IF `gender_division` が入力され、`MEN`、`WOMEN`、`MIXED` 以外である, THEN THE Tournament_Manager SHALL Tournament を保存せずに、`gender_division` の入力欄に許可されていない値であることを示すエラーメッセージを表示する
19. IF Prize が 200 文字を超える, THEN THE Tournament_Manager SHALL Tournament を保存せずに、Prize の入力欄に最大文字数（200 文字）を示すエラーメッセージを表示する
20. WHEN Prize が空文字または空白のみで登録が実行される, THE Tournament_Manager SHALL `tournaments.prize` を NULL として保存する
21. IF バリデーションエラーが発生する, THEN THE Tournament_Manager SHALL 入力済みのすべての項目の値を保持したまま登録画面を再表示し、複数のバリデーションエラーが同時に発生した場合は該当するすべての項目のエラーメッセージを同時に表示する
22. IF 保存処理がデータベースエラーで失敗する, THEN THE Tournament_Manager SHALL 保存に失敗したことを示すエラーメッセージを表示し、Tournament を 1 件も作成せず、入力済みのすべての項目の値を保持したまま登録画面を再表示する

### Requirement 4: 要項画像の登録

**User Story:** As an Admin_User, I want 大会の要項画像をアップロードしたい, so that ユーザーが要項のポスターを確認できる。

#### Acceptance Criteria

1. WHEN Admin_User が画像ファイルを選択する, THE Tournament_Manager SHALL 選択から 1 秒以内に、保存前の選択画像のプレビューを表示する
2. WHEN Admin_User が PNG、JPEG、WebP のいずれかの形式で 5MB 以下の画像ファイルを指定して大会を保存する, THE Tournament_Manager SHALL 画像を Image_Storage に保存し、配信用 URL を `image_url` に設定する
3. IF 選択されたファイルの形式が PNG、JPEG、WebP 以外である, THEN THE Tournament_Manager SHALL 画像と大会情報を保存せず、許可される形式（PNG、JPEG、WebP）を示す形式エラーを表示し、入力済みの他のフォーム項目を保持する
4. IF 選択されたファイルが 5MB（5,242,880 バイト）を超える, THEN THE Tournament_Manager SHALL 画像と大会情報を保存せず、上限サイズ 5MB を示すサイズエラーを表示し、入力済みの他のフォーム項目を保持する
5. WHEN Admin_User が既存の大会の画像を差し替えて保存する, THE Tournament_Manager SHALL 新しい画像を保存し、`image_url` を新しい URL に更新し、差し替え前の画像を Image_Storage から削除する
6. IF 大会の保存が失敗する, THEN THE Tournament_Manager SHALL その保存処理でアップロードした画像を Image_Storage から削除し、保存失敗を示すエラーを表示し、既存大会の場合は既存の `image_url` と差し替え前の画像を変更せずに保持する
7. THE Tournament_Manager SHALL 大会の開催日・会場・参加費・種目・定員を画像とは別にテキストとして保存する
8. IF 画像のアップロードが失敗する, THEN THE Tournament_Manager SHALL 大会情報を保存せず、アップロード失敗を示すエラーを表示し、入力済みのフォーム項目を保持する

### Requirement 5: 大会情報の編集

**User Story:** As an Admin_User, I want 登録済みの大会情報を修正したい, so that 要項の変更を反映できる。

#### Acceptance Criteria

1. WHEN Admin_User が存在する大会の編集画面を開く, THE Tournament_Manager SHALL 現在保存されているすべての編集可能項目の値を各入力欄に表示し、表示完了までに 2 秒以内に応答する
2. WHEN Admin_User が Requirement 3 の受入基準 6 から 21 の検証を満たす値で更新を実行する, THE Tournament_Manager SHALL 変更内容を保存し、`updated_at` に JST の現在日時を設定する
3. WHEN 更新が成功する, THE Tournament_Manager SHALL 成功メッセージを表示し、更新後の値を詳細画面に表示する
4. IF 編集時の入力値が Requirement 3 の受入基準 6 から 21 の検証のいずれかを満たさない, THEN THE Tournament_Manager SHALL 保存せずに、違反した項目ごとに違反内容を示すエラーを該当入力欄に表示し、入力済みの値を保持する
5. IF 更新後の定員数が Confirmed_Entry 数を下回る, THEN THE Tournament_Manager SHALL 保存せずに、現在の Confirmed_Entry 数を示すエラーを返し、入力済みの値を保持する
6. WHEN 参加費が変更され、対象の大会に Confirmed_Entry が 1 件以上存在する, THE Tournament_Manager SHALL 保存前に変更前の金額、変更後の金額、および Confirmed_Entry 数を示す確認ダイアログを表示する
7. WHEN Admin_User が確認ダイアログで確認を取り消す, THE Tournament_Manager SHALL 保存せずに編集画面へ戻し、入力済みの値を保持する
8. IF Tournament_Status が `FINISHED` または `CANCELLED` であり、かつ開催日・定員数・参加費のいずれかを変更する更新が実行される, THEN THE Tournament_Manager SHALL 保存せずに、変更できない項目を示すエラーを返す
9. IF 編集対象の大会が存在しない, THEN THE Tournament_Manager SHALL 404 応答を返し、データを変更しない
10. IF 編集画面を開いた時点の `updated_at` と保存実行時点の `updated_at` が異なる, THEN THE Tournament_Manager SHALL 保存せずに、他の操作で更新されたことと再読み込みが必要であることを示すエラーを返す

### Requirement 6: 大会ステータスの変更

**User Story:** As an Admin_User, I want 大会のステータスを切り替えたい, so that 公開・受付・締切・終了を運営状況に合わせて制御できる。

#### Acceptance Criteria

1. WHEN Admin_User が大会詳細画面でステータス変更を選択する, THE Tournament_Manager SHALL 現在の Tournament_Status から、基準 2 で許可された遷移先のステータスのみを選択肢として表示する
2. THE Tournament_Manager SHALL 次のステータス遷移のみを許可する: `DRAFT` から `UPCOMING`・`OPEN`・`CANCELLED`、`UPCOMING` から `DRAFT`・`OPEN`・`CANCELLED`、`OPEN` から `CLOSED`・`CANCELLED`、`CLOSED` から `OPEN`・`FINISHED`・`CANCELLED`
3. IF 基準 2 で許可されていないステータス遷移（現在と同じステータスへの変更を含む）が要求される, THEN THE Tournament_Manager SHALL `status` と `updated_at` を変更せず、要求された遷移が許可されていないことを示すエラーを Admin_User に返す
4. WHILE Tournament_Status が `FINISHED` または `CANCELLED` である, THE Tournament_Manager SHALL ステータス変更の選択肢を表示せず、変更要求を受け付けずに、終了済みまたは中止済みの大会は変更できないことを示すエラーを返す
5. WHEN ステータスが変更される, THE Tournament_Manager SHALL `status` と `updated_at` を同一トランザクションで更新し、更新に失敗した場合は両方を変更前の値のまま保持して、更新失敗を示すエラーを Admin_User に返す
6. IF Admin_User が画面を開いた時点の `updated_at` または Tournament_Status が、変更要求の時点で保存されている値と異なる, THEN THE Tournament_Manager SHALL 変更を適用せず、他の操作で大会が更新されたため再読み込みが必要であることを示すエラーを返す
7. WHEN Admin_User が `OPEN` への変更を実行する, THE Tournament_Manager SHALL 大会の Required_Fields がすべて保存済みであることを検証し、未保存の項目が 1 つ以上ある場合は、ステータスを変更せず、未保存の項目名を列挙したエラーを返す
8. WHEN 大会の `OPEN` への変更が成功する, THE Tournament_Manager SHALL 変更成功から 5 秒以内に、その大会をユーザー向け大会一覧で受付中として表示する
9. WHILE Tournament_Status が `DRAFT` である, THE Tournament_Manager SHALL その大会をユーザー向けの大会一覧・詳細に表示せず、ユーザー向け詳細画面が直接要求された場合は大会が存在しない場合と同じ応答を返す

### Requirement 7: 大会の中止

**User Story:** As an Admin_User, I want 大会を中止にしたい, so that 参加者への通知とキャンセル関連の処理が漏れなく行われる。

#### Acceptance Criteria

1. WHEN Admin_User が Tournament_Status を `CANCELLED` に変更する操作を選択する, THE Tournament_Manager SHALL Tournament_Status を変更する前に、対象大会の Confirmed_Entry 数、`waitlists.status` が `WAITING` または `OFFERED` の件数、`admin_status` が請求中を示す Paid_Cancellation 件数、Entry_Status が `CONFIRMED` または `ATTENDED` かつ Payment_Status が `PAID` のエントリー件数（入金済み件数）を、それぞれ 0 以上の整数で表示する確認ダイアログを表示する
2. IF Admin_User が確認ダイアログでキャンセルを選択する、または確認ダイアログを閉じる, THEN THE Tournament_Manager SHALL Tournament_Status、Waitlist、Paid_Cancellation を変更しない
3. WHEN Admin_User が確認ダイアログで中止を確定する, THE Tournament_Manager SHALL Tournament_Status を `CANCELLED` に更新する
4. IF 中止を確定した時点の Tournament_Status が既に `CANCELLED` である, THEN THE Tournament_Manager SHALL 状態を変更せず、既に中止済みであることを示すエラーを Admin_User に表示する
5. WHEN 大会が `CANCELLED` に変更される, THE Tournament_Manager SHALL 対象大会の `waitlists.status` が `WAITING` または `OFFERED` のすべてのレコードを `EXPIRED` に更新する
6. WHEN 大会が `CANCELLED` に変更される, THE Tournament_Manager SHALL 対象大会の `admin_status` が請求中を示すすべての Paid_Cancellation の `admin_status` を `WAIVED` に更新する
7. WHEN 大会が `CANCELLED` に変更される, THE Tournament_Manager SHALL `WAIVED` に更新した各 Paid_Cancellation の `admin_notes` の既存内容を保持したまま末尾に、大会中止により請求を取り下げた旨と中止確定日時（日本標準時、分単位）を追記する
8. WHEN 大会が `CANCELLED` に変更される, THE Notification_Service SHALL 対象大会のすべての Confirmed_Entry の代表者へ、大会中止を伝える中止通知を 1 件ずつ送信する
9. WHEN 中止通知の送信処理が宛先ごとに完了または失敗する, THE Notification_Service SHALL 宛先、送信成功または失敗の別、処理日時を `notification_logs` に 1 宛先につき 1 レコード記録する
10. IF 中止通知の送信が 1 件以上の宛先で失敗する, THEN THE Tournament_Manager SHALL Tournament_Status を `CANCELLED` に維持し、失敗した宛先件数と全宛先件数を Admin_User に表示する
11. IF Waitlist または Paid_Cancellation の更新が失敗する, THEN THE Tournament_Manager SHALL Tournament_Status、Waitlist、Paid_Cancellation を中止操作前の状態に戻し、中止通知を送信せず、更新に失敗した旨を示すエラーを Admin_User に表示する
12. WHILE Tournament_Status が `CANCELLED` である, THE Tournament_Manager SHALL 新規エントリーとキャンセル待ち登録の要求を拒否し、大会が中止済みであることを示すエラーを要求者に表示する
13. IF 確認ダイアログの表示時点で入金済み件数が 1 件以上である, THEN THE Tournament_Manager SHALL 確認ダイアログに、入金済みエントリーが存在することと、返金処理は本機能では行われないことを示す注意文を表示する
14. WHEN 大会が `CANCELLED` に変更される, THE Tournament_Manager SHALL 対象大会のエントリーの `payment_status` と `paid_at` を自動では変更しない（Payment_Status の変更は Requirement 15 の Admin_User による明示的な操作のみ）

### Requirement 8: 過去大会のコピー作成

**User Story:** As an Admin_User, I want 過去の大会設定を複製して新しい大会を作りたい, so that 同種の大会の登録作業を短縮できる。

#### Acceptance Criteria

1. WHEN Admin_User が大会詳細画面でコピー作成を選択する, THE Tournament_Manager SHALL コピー元大会の値を初期値として入力した登録画面を 3 秒以内に表示する
2. WHEN コピー登録画面が表示される, THE Tournament_Manager SHALL 大会名、種目区分、募集階級、会場名、コート情報、要項詳細説明、景品、定員数、参加費、チーム人数、1ヶ月前アラート閾値、サーフェス、大会シリーズ、部門の性別区分、要項画像をコピー元と同一の値で入力済みにする
3. WHEN コピー登録画面が表示される, THE Tournament_Manager SHALL 開催日、開始時刻、終了時刻、受付開始日時、受付締切日時を空欄にする
4. WHEN Admin_User が有効な値でコピー登録を実行する, THE Tournament_Manager SHALL 新しい UUID を採番し、`copy_from_id` にコピー元の `tournaments.id` を設定し、Tournament_Status を `DRAFT` に設定して保存する
5. WHEN コピーによる大会が保存される, THE Tournament_Manager SHALL コピー元のエントリー、キャンセル待ち、キャンセル、ドロー表 URL（`draw_pdf_url`）を引き継がず、新しい大会のエントリー件数、キャンセル待ち件数、キャンセル件数を 0 件、`draw_pdf_url` を未設定にする
6. WHEN コピー元の要項画像が引き継がれた状態でコピー登録が保存される, THE Tournament_Manager SHALL 画像を Image_Storage に複製し、コピー元と別の `image_url` を設定する
7. IF 要項画像の複製に失敗する, THEN THE Tournament_Manager SHALL 新しい大会を保存せず、画像の複製に失敗したことを示すエラーメッセージを表示し、コピー登録画面の入力内容を保持する
8. THE Tournament_Manager SHALL コピー登録に Requirement 3 の受入基準 6 から 22 と同じ検証を適用する
9. IF コピー元の大会が存在しない, THEN THE Tournament_Manager SHALL 404 応答を返し、コピー登録画面を表示せず、コピー元大会が存在しないことを示すエラーメッセージを表示する

### Requirement 9: 大会の一括登録

**User Story:** As an Admin_User, I want 複数の日程・種目の大会を一度に登録したい, so that シリーズ開催の登録作業を短縮できる。

#### Acceptance Criteria

1. WHEN Admin_User が一括登録画面で共通項目と 1 件以上 50 件以下の（開催日、種目区分）の組み合わせを入力して登録を実行する, THE Tournament_Manager SHALL 組み合わせごとに 1 件の Tournament を作成し、作成した件数を Admin_User に表示する
2. WHEN 一括登録で Tournament が作成される, THE Tournament_Manager SHALL それぞれに別の UUID を採番し、Tournament_Status を `DRAFT` に設定する
3. THE Tournament_Manager SHALL 一括登録 1 回あたり最小 1 件、最大 50 件の組み合わせを受け付ける
4. IF 組み合わせが 0 件または 51 件以上である, THEN THE Tournament_Manager SHALL Tournament を 1 件も作成せず、受付可能な件数が 1 件以上 50 件以下であることを示すエラーを表示し、入力内容を保持する
5. WHEN Admin_User が一括登録の実行操作を行う, THE Tournament_Manager SHALL 登録を確定する前に、作成される大会の件数と、大会ごとの開催日・種目区分をプレビューとして表示し、Admin_User が確定操作を行うまで Tournament を作成しない
6. THE Tournament_Manager SHALL 一括登録の各大会に Requirement 3 の受入基準 6 から 19 と同じ検証を適用する
7. IF 組み合わせの中に検証エラーとなるものが 1 件以上ある, THEN THE Tournament_Manager SHALL Tournament を 1 件も作成せず、エラーとなったすべての組み合わせについて、入力一覧での行番号（1 始まり）とエラー内容を表示し、入力内容を保持する
8. IF 一括登録の保存が途中で失敗する, THEN THE Tournament_Manager SHALL 同じ一括登録で作成した Tournament をすべて取り消して 0 件の状態に戻し、保存に失敗したことを示すエラーを表示し、入力内容を保持する
9. IF 同一の（開催日、種目区分、大会名）の組み合わせが一括登録の入力内に 2 件以上ある, THEN THE Tournament_Manager SHALL Tournament を 1 件も作成せず、重複している組み合わせの行番号（1 始まり）を示すエラーを表示し、入力内容を保持する

### Requirement 10: 大会の削除

**User Story:** As an Admin_User, I want 誤って登録した大会を削除したい, so that 不要な大会が残らない。

#### Acceptance Criteria

1. WHEN Admin_User が Tournament_Status が `DRAFT` の大会の削除を選択する, THE Tournament_Manager SHALL 大会名を含む削除確認ダイアログを表示し、「削除する」と「キャンセル」の 2 つの操作を提供する
2. WHEN Admin_User が削除確認ダイアログで「キャンセル」を選択する, THE Tournament_Manager SHALL 大会を削除せずダイアログを閉じ、大会のデータを変更しない
3. WHEN Admin_User が削除確認ダイアログで削除を確定し、対象大会の Tournament_Status が `DRAFT` であり、対象大会に紐づくエントリーが 0 件であり、かつ対象大会が他の大会の `copy_from_id` として参照されていない, THE Tournament_Manager SHALL 対象大会を削除し、削除完了を示す通知とともに大会一覧を表示する
4. IF 削除確定時点で対象大会の Tournament_Status が `DRAFT` 以外である, THEN THE Tournament_Manager SHALL 削除を実行せず、`DRAFT` 以外の大会は削除できないことと中止（`CANCELLED`）の利用を案内するエラーを表示し、大会のデータを変更しない
5. IF 削除確定時点で対象大会に紐づくエントリーが 1 件以上存在する, THEN THE Tournament_Manager SHALL 削除を実行せず、エントリーが存在するため削除できないことを示すエラーを表示し、大会とエントリーのデータを変更しない
6. IF 削除確定時点で対象大会が他の大会の `copy_from_id` として参照されている, THEN THE Tournament_Manager SHALL 削除を実行せず、他の大会から複製元として参照されているため削除できないことを示すエラーを表示し、大会のデータを変更しない
7. WHEN 大会が削除される, THE Tournament_Manager SHALL その大会の要項画像を Image_Storage から削除する
8. IF 大会の削除は成功したが要項画像の Image_Storage からの削除に失敗する, THEN THE Tournament_Manager SHALL 大会の削除結果を維持し、要項画像の削除に失敗したことを示す警告を Admin_User に表示する

### Requirement 11: 大会詳細画面での運営状況の表示

**User Story:** As an Admin_User または Operator_User, I want 大会ごとの申込状況を確認したい, so that 定員の充足状況と対応が必要な案件を把握できる。

#### Acceptance Criteria

1. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL 対象大会に登録済みの全項目（Prize を含む）を、値が未設定（NULL）の項目は未設定であることが判別できる表示で、表示する
2. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL Confirmed_Entry 数と定員数を「Confirmed_Entry 数 / 定員数」の形式の比率と、整数パーセント（小数点以下切り捨て、0〜100%）で表示する
3. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL 対象大会の `WAITING` 状態の Waitlist 件数を 0 以上の整数で表示する
4. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL 対象大会の Paid_Cancellation 件数を 0 以上の整数で表示する
5. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL `entry_fee` に Confirmed_Entry 数を乗じた参加費合計を、通貨単位付きの整数金額で表示する
6. IF 大会の Tournament_Status が `DRAFT` で、現在日時が `entry_start_at` 以降である, THEN THE Tournament_Manager SHALL 受付開始日時を過ぎているのに未公開である旨の警告を、大会詳細画面に表示する
7. IF 現在日時が開催日の 1 か月前の同日 00:00 以降であり、かつ `alert_threshold` が設定され、かつ Confirmed_Entry 数が `alert_threshold` 未満である, THEN THE Tournament_Manager SHALL 定員未達の警告を、大会詳細画面に表示する
8. IF Confirmed_Entry 数、Waitlist 件数、Paid_Cancellation 件数、Paid_Entry 件数、Unpaid_Entry 件数のいずれかの取得に失敗する, THEN THE Tournament_Manager SHALL 取得に失敗した項目に取得失敗を示す表示を行い、取得に成功した他の項目は通常どおり表示する
9. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL Requirement 14 のエントリー状況画面（`/admin/tournaments/{id}/entries`）へ遷移するリンクを表示する
10. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL 対象大会の `CONFIRMED` または `ATTENDED` のエントリーのうち Paid_Entry の件数（入金済み件数）を 0 以上の整数で表示する
11. WHEN 大会詳細画面が表示される, THE Tournament_Manager SHALL 対象大会の `CONFIRMED` または `ATTENDED` のエントリーのうち Unpaid_Entry の件数（未入金件数）を 0 以上の整数で表示する
12. THE Tournament_Manager SHALL 大会詳細画面に入金状況を更新する操作要素を表示しない
13. WHEN Payment_Updater によるエントリーの Payment_Status 更新が成功する, THE Tournament_Manager SHALL 大会詳細画面を次に表示する際に、更新後の値に基づく入金済み件数と未入金件数を表示する

### Requirement 12: 管理画面の UI 品質

**User Story:** As an Admin_User または Operator_User, I want 他の管理画面と統一された操作性で大会管理を使いたい, so that 迷わず操作できる。

#### Acceptance Criteria

1. THE Tournament_Manager SHALL すべてのボタン・リンク・入力要素に、縦 44px 以上かつ横 44px 以上のタップ領域を確保する
2. THE Tournament_Manager SHALL すべてのテキスト（ボタン・ラベル・注釈・バッジ・トースト通知を含む）に 12px 以上の文字サイズを使用する
3. THE Tournament_Manager SHALL `docs/ui-design-system.md` に定義されたカラートークン、ボタンバリアント、角丸規約のみを使用し、同ファイルに定義のない色値・ボタンバリアント・角丸値を使用しない
4. THE Tournament_Manager SHALL ライトモードとダークモードの双方で、本文テキストと背景のコントラスト比を 4.5:1 以上、大きな文字（18px 以上、または 14px 以上の太字）と背景のコントラスト比を 3:1 以上に保って表示する
5. THE Tournament_Manager SHALL Lucide アイコンのみをアイコンとして使用し、画面上のラベル・ボタン・通知・メッセージに Unicode 絵文字を含めない
6. WHEN 画面幅が 768px 未満である, THE Tournament_Manager SHALL 一覧を 1 カラムのカード形式で表示し、横スクロールを発生させない
7. WHEN 画面幅が 768px 以上である, THE Tournament_Manager SHALL 一覧を表形式で表示する
8. WHEN サーバー処理の結果が成功または失敗である, THE Tournament_Manager SHALL 処理完了から 1 秒以内に、成功時は成功を示すトースト通知、失敗時は失敗理由を示すトースト通知を表示し、表示開始から 3 秒以上 10 秒以下のあいだ表示を維持する
9. WHEN 保存・更新・削除・入金状況更新の処理が開始される, THE Tournament_Manager SHALL 実行ボタンを即時（100ms 以内）に無効化して処理中を示す表示に切り替え、処理が成功または失敗で完了した時点で無効化を解除する
10. THE Tournament_Manager SHALL 一覧・詳細・登録フォームのコンテンツ最大幅を `max-w-4xl` とする
11. IF サーバー処理が失敗する, THEN THE Tournament_Manager SHALL 失敗を示すトースト通知を表示し、フォームに入力済みの値を保持したまま再操作可能な状態に戻す

### Requirement 13: 大会データの整合性

**User Story:** As a 運営責任者, I want 大会データが常に整合した状態で保たれてほしい, so that ユーザー画面と運営画面で矛盾が生じない。

#### Acceptance Criteria

1. WHEN Tournament_Manager が大会の作成、編集、削除のいずれかの書き込みリクエストを受信する, THE Tournament_Manager SHALL 書き込み処理の実行前にサーバー側で全入力項目の検証を実行する
2. WHEN Tournament_Manager が大会の日付または時刻を保存する, THE Tournament_Manager SHALL 日付を `YYYY-MM-DD` 形式、時刻を `HH:mm` 形式の JST の文字列として `tournaments` テーブルに保存する
3. FOR ALL 検証を通過した大会入力値, THE Tournament_Manager SHALL 保存した後に読み出した大会の全入力項目を入力値と完全に一致させる（保存と読み出しの往復で値が変化しない）
4. IF 大会の入力値が検証に失敗する, THEN THE Tournament_Manager SHALL 書き込みを拒否し、失敗した項目を示すエラーを呼び出し元に返し、`tournaments` テーブルのレコード数と既存レコードの全項目値を変化させない
5. WHEN 同一の更新内容で編集を 2 回続けて実行する, THE Tournament_Manager SHALL 2 回目の実行後の大会の全項目値を 1 回目の実行後と同一に保ち、`tournaments` テーブルのレコード数を変化させない
6. THE Tournament_Manager SHALL 大会の書き込み処理で、ユーザー入力値を SQL 文字列へ連結せず、すべてバインド変数として渡す
7. WHEN Tournament_Manager が大会名、会場名、説明文を画面に表示する, THE Tournament_Manager SHALL HTML の特殊文字（`<`、`>`、`&`、`"`、`'`）をエスケープして出力し、入力された文字列を文字として表示する
8. IF 大会の書き込み処理が途中で失敗する, THEN THE Tournament_Manager SHALL 変更を破棄して処理前の状態を保持し、失敗を示すエラーを呼び出し元に返す
9. WHEN データベースの初期化処理が `prize` 列を持たない既存の `tournaments` テーブルに対して実行される, THE Tournament_Manager SHALL NULL 許容の TEXT 型の `prize` 列を追加し、既存の全レコードの `prize` 以外の全項目値と全レコード数を変化させない
10. WHEN データベースの初期化処理が `prize` 列を既に持つ `tournaments` テーブルに対して再度実行される, THE Tournament_Manager SHALL スキーマとデータを変更せず、エラーを発生させない
11. WHEN `prize` 列が追加される, THE Tournament_Manager SHALL 既存の全レコードの `prize` を NULL に設定する
12. WHEN 本機能のスキーマ変更が完了する, THE Tournament_Manager SHALL `docs/db-schema.md` の `tournaments` に関する ER 図、列定義、追加列の説明へ `prize` 列（TEXT、NULL 許容、最大 200 文字）を反映する
13. WHEN データベースの初期化処理が `payment_status` 列と `paid_at` 列を持たない既存の `entries` テーブルに対して実行される, THE Payment_Migration SHALL `payment_status`（TEXT、NOT NULL、既定値 `UNPAID`、`UNPAID` / `PAID` / `REFUNDED` のみを許可）と `paid_at`（TEXT、NULL 許容）を追加し、既存の全レコードの両列以外の全項目値と全レコード数を変化させない
14. WHEN Payment_Migration が実行される, THE Payment_Migration SHALL 既存の全レコードの `payment_status` を `UNPAID`、`paid_at` を NULL に設定する
15. WHEN データベースの初期化処理が `payment_status` 列と `paid_at` 列を既に持つ `entries` テーブルに対して再度実行される, THE Payment_Migration SHALL スキーマとデータ（`PAID` や `REFUNDED` に設定済みの値を含む）を変更せず、エラーを発生させない
16. IF `payment_status` 列のみ、または `paid_at` 列のみが既に存在する, THEN THE Payment_Migration SHALL 存在しない列のみを追加し、既存の列の値を変更しない
17. IF Payment_Migration の列追加が失敗する, THEN THE Payment_Migration SHALL `entries` テーブルの既存データを変更せず、失敗を示すエラーを呼び出し元に返す
18. WHEN 本機能のスキーマ変更が完了する, THE Tournament_Manager SHALL `docs/db-schema.md` の `entries` に関する ER 図、列定義、追加列の説明へ `payment_status` 列（TEXT、NOT NULL、既定値 `UNPAID`、`UNPAID` / `PAID` / `REFUNDED`）と `paid_at` 列（TEXT、NULL 許容、JST）を反映する
19. WHEN データベースの初期化処理が実行される, THE Payment_Migration SHALL `entry_payment_logs` テーブル（`id` TEXT 主キー、`entry_id` TEXT NOT NULL で `entries(id)` を参照、`from_status` TEXT NOT NULL、`to_status` TEXT NOT NULL、`changed_by` TEXT NOT NULL で `users(id)` を参照、`changed_at` TEXT NOT NULL・JST）を `CREATE TABLE IF NOT EXISTS` で作成し、既に存在する場合は既存の記録を変更せずエラーを発生させない
20. WHEN 本機能のスキーマ変更が完了する, THE Tournament_Manager SHALL `docs/db-schema.md` の ER 図と列定義へ `entry_payment_logs` を反映する
21. WHEN Payment_Updater が `payment_status` を更新する, THE Payment_Updater SHALL `payment_status` と `paid_at` の値を、`PAID` のとき Paid_At が非 NULL、`UNPAID` のとき NULL となる組み合わせに保つ

### Requirement 14: 大会別エントリー状況の詳細確認

**User Story:** As an Admin_User または Operator_User, I want 大会ごとのエントリー・キャンセル待ち・キャンセルの状況を詳細に確認したい, so that 申込状況と対応が必要な案件を大会単位で把握できる。

#### Acceptance Criteria

1. THE Entry_Status_Viewer SHALL エントリー状況画面を `/admin/tournaments/{id}/entries` で提供する
2. WHEN `entries.view` 権限を持つ Admin_User または Operator_User が `/admin/tournaments/{id}/entries` を開く, THE Entry_Status_Viewer SHALL 3 秒以内にエントリー状況画面の件数表示と各一覧の先頭ページを表示する
3. WHEN 未ログインのユーザーが `/admin/tournaments/{id}/entries` を開く, THE Admin_Console SHALL エントリー状況を表示せずにログイン画面へ遷移させる
4. WHEN `role` が `USER` または `LEADER` のユーザーが `/admin/tournaments/{id}/entries` を開く, THE Admin_Console SHALL エントリー状況を表示せずに 404 応答を返す
5. IF 指定された `{id}` の大会が存在しない、または `{id}` が大会 ID（UUID）の形式として解釈できない, THEN THE Entry_Status_Viewer SHALL 404 応答を返し、エントリー状況を表示しない
6. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL 大会名、開催日、Tournament_Status、定員数を画面上部に表示し、大会詳細画面へ戻るリンクを表示する
7. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL `CONFIRMED`、`WAITING`、`CANCELLED`、`ATTENDED` のそれぞれの Entry_Status について、対象大会の `entries` の件数を 0 以上の整数で表示する（該当が 0 件の Entry_Status は 0 と表示する）
8. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL エントリー一覧の各行に、Entry_Representative の氏名、Entry_Team_Name、申込日時（`entries.applied_at`）、Payment_Status、Entry_Status を表示する
9. IF エントリーの `team_id` が NULL である, THEN THE Entry_Status_Viewer SHALL そのエントリーの Entry_Team_Name の欄に「チーム未設定」を示す表示を行い、空欄にしない
10. THE Entry_Status_Viewer SHALL エントリー一覧の各行の Payment_Status を、`entries.payment_status` の値に対応する「未入金」「入金済み」「返金済み」の表示で示す
11. WHERE エントリーの Payment_Status が `PAID` で Paid_At が設定されている, THE Entry_Status_Viewer SHALL そのエントリーの行に Paid_At を `tabular-nums` で表示する（`REFUNDED` では保持している Paid_At があればそれを表示する）
12. WHERE エントリーの `is_proxy` が 1 である, THE Entry_Status_Viewer SHALL そのエントリーの行に、管理者による代理登録であることを示す表示を行う
13. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL エントリー一覧を申込日時の昇順で表示し、申込日時が同一のエントリーは `entries.id` の昇順で表示する
14. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL 対象大会の Waitlist の一覧を `queue_number` の昇順で表示し、各行に順位（`queue_number`）、代表者の氏名、Entry_Team_Name、`waitlists.status` の値を表示する
15. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL 対象大会のキャンセル一覧を `cancelled_at` の降順（同一時刻は `cancellations.id` の降順）で表示し、各行にエントリーの Entry_Representative の氏名、Entry_Team_Name、`cancelled_at`、有償または無償の別（`is_paid`）、`fee_amount`、`admin_status` の値を表示する
16. WHEN ユーザーが Entry_Status を選択する, THE Entry_Status_Viewer SHALL エントリー一覧に、選択された Entry_Status に一致するエントリーのみを表示する
17. WHEN ユーザーが 1 文字以上 100 文字以下のキーワードを入力する, THE Entry_Status_Viewer SHALL エントリー一覧、Waitlist 一覧、キャンセル一覧のそれぞれに、Entry_Representative の氏名（`real_name`）、読み仮名（`kana_name`）、Entry_Team_Name のいずれかに入力文字列を部分一致で含む行のみを、大文字小文字を区別せずに表示する
18. IF ユーザーが 100 文字を超えるキーワードを入力する, THEN THE Entry_Status_Viewer SHALL 絞り込みを実行せず、文字数超過を示すエラー表示を行い、直前の絞り込み結果と条件を保持する
19. WHILE 複数の絞り込み条件（Entry_Status、Payment_Status、キーワード）が指定されている, THE Entry_Status_Viewer SHALL エントリー一覧に、指定されたすべての条件を満たすエントリーのみを表示する
20. WHEN 絞り込み条件が変更される, THE Entry_Status_Viewer SHALL Entry_Status ごとの件数の表示を絞り込み前の対象大会全体の件数のまま維持する
21. WHEN 一覧の行数が 1 ページの表示件数（20 件）を超える, THE Entry_Status_Viewer SHALL エントリー一覧、Waitlist 一覧、キャンセル一覧のそれぞれを 1 ページ 20 件で分割し、現在のページ番号、総ページ数、前後のページへ移動する操作を表示する
22. WHEN 絞り込み条件が変更される, THE Entry_Status_Viewer SHALL 一覧の表示ページを 1 ページ目に戻す
23. IF 一覧の絞り込み結果が 0 件であり、かつ絞り込み前の件数が 1 件以上である, THEN THE Entry_Status_Viewer SHALL 該当するデータがない旨のメッセージを該当する一覧に表示し、指定中の絞り込み条件を保持する
24. IF 対象大会のエントリー、Waitlist、キャンセルのいずれかが絞り込み前に 0 件である, THEN THE Entry_Status_Viewer SHALL その一覧に、まだデータがない旨のメッセージを表示する
25. THE Entry_Status_Viewer SHALL 個人情報として表示する項目を、Entry_Representative の氏名と読み仮名に限定し、メールアドレス、電話番号、生年月日、ログイン ID を表示しない
26. THE Entry_Status_Viewer SHALL 個人情報を含むデータの取得を、`entries.view` 権限を持つ Admin_User と Operator_User のサーバー処理に限定し、権限の検証をデータ取得の前に実行する
27. IF `entries.view` 権限を持たないユーザーがエントリー状況のデータ取得処理を直接呼び出す, THEN THE Entry_Status_Viewer SHALL データを返さず、権限不足を示すエラーを呼び出し元へ返す
28. IF 件数、エントリー一覧、Waitlist 一覧、キャンセル一覧のいずれかの取得に失敗する, THEN THE Entry_Status_Viewer SHALL 取得に失敗した部分に取得失敗を示す表示と再読み込み操作を表示し、取得に成功した他の部分は通常どおり表示し、指定中の絞り込み条件を保持する
29. THE Entry_Status_Viewer SHALL エントリー、Waitlist、キャンセルのデータを閲覧専用で表示し、Payment_Status の更新（Requirement 15）を除く変更操作を提供しない
30. THE Entry_Status_Viewer SHALL キーワード、Entry_Status、ページ番号を SQL 文字列へ連結せず、すべてバインド変数として渡す
31. THE Entry_Status_Viewer SHALL 一覧と件数の表示に Requirement 12 の UI 品質基準を適用する
32. WHEN ユーザーが Payment_Status（`UNPAID`、`PAID`、`REFUNDED`）を選択する, THE Entry_Status_Viewer SHALL エントリー一覧に、選択された Payment_Status に一致するエントリーのみを表示する
33. WHEN エントリー状況画面が表示される, THE Entry_Status_Viewer SHALL `UNPAID`、`PAID`、`REFUNDED` のそれぞれの Payment_Status について、対象大会の `entries` の件数を 0 以上の整数で表示し、絞り込み条件が変更されても絞り込み前の対象大会全体の件数のまま維持する
34. THE Entry_Status_Viewer SHALL キャンセル一覧の有償または無償の別（`is_paid`）と `admin_status` を Payment_Status とは別の項目として表示し、Payment_Status の表示に代用しない
35. WHERE ログインユーザーが `entries.manage` 権限を持たない（Operator_User）, THE Entry_Status_Viewer SHALL エントリー一覧に入金状況を更新する操作要素を表示しない
36. THE Entry_Status_Viewer SHALL Payment_Status を SQL 文字列へ連結せず、バインド変数として渡す

### Requirement 15: 入金状況の更新

**User Story:** As an Admin_User, I want エントリー状況画面で各エントリーの入金状況を更新したい, so that 入金の確認結果を運営データへ正しく反映できる。

#### Acceptance Criteria

1. THE Admin_Console SHALL 権限 `entries.manage` を ADMIN にのみ付与し、OPERATOR には付与しない
2. WHERE ログインユーザーが `entries.manage` 権限を持つ（Admin_User）, THE Payment_Updater SHALL エントリー状況画面のエントリー一覧の各行に、その行の Payment_Status で許可される Payment_Transition の操作要素を表示する
3. WHERE ログインユーザーが Operator_User である, THE Payment_Updater SHALL エントリー一覧に Payment_Status の更新操作要素を表示せず、Payment_Status を閲覧のみ可能にする
4. WHEN Payment_Updater の更新処理が呼び出される, THE Payment_Updater SHALL 処理の実行前に、呼び出しユーザーの `users` の最新の値に基づいて `entries.manage` 権限を検証する
5. IF Operator_User が Payment_Status 更新のサーバー処理を直接呼び出す, THEN THE Payment_Updater SHALL データを変更せずに、権限不足を示すエラーを呼び出し元へ返す
6. IF 未ログインのユーザーが Payment_Status 更新のサーバー処理を直接呼び出す, THEN THE Payment_Updater SHALL データを変更せずに、認証が必要であることを示すエラーを呼び出し元へ返す
7. THE Payment_Updater SHALL Payment_Transition として `UNPAID` から `PAID`、`PAID` から `UNPAID`、`PAID` から `REFUNDED` のみを許可する
8. IF 基準 7 で許可されていない Payment_Transition（`REFUNDED` からの遷移、`UNPAID` から `REFUNDED` への遷移を含む。基準 19 で扱う既に更新済みの場合を除く）が要求される, THEN THE Payment_Updater SHALL `payment_status` と `paid_at` を変更せず、要求された遷移が許可されていないことを示すエラーを返す
9. WHEN Admin_User が `UNPAID` のエントリーを `PAID` へ更新する, THE Payment_Updater SHALL `payment_status` を `PAID` にし、`paid_at` に JST の現在日時を設定する
10. WHEN Admin_User が `PAID` のエントリーを `UNPAID` へ更新する（入金の取り消し）, THE Payment_Updater SHALL `payment_status` を `UNPAID` にし、`paid_at` を NULL にする
11. WHEN Admin_User が `PAID` のエントリーを `REFUNDED` へ更新する, THE Payment_Updater SHALL `payment_status` を `REFUNDED` にし、`paid_at` を変更せず保持する
12. THE Payment_Updater SHALL `REFUNDED` への更新を返金の記録のみとして扱い、返金の金銭的な処理を実行しない
13. WHEN Admin_User が更新操作を選択する, THE Payment_Updater SHALL 更新を実行する前に、対象エントリーの Entry_Representative の氏名、変更前の Payment_Status、変更後の Payment_Status を示す確認ダイアログを表示し、「更新する」と「キャンセル」の 2 つの操作を提供する
14. WHEN Admin_User が確認ダイアログで「キャンセル」を選択する、または確認ダイアログを閉じる, THE Payment_Updater SHALL `payment_status`、`paid_at`、Payment_Log を変更しない
15. IF 対象エントリーの Entry_Status が `CANCELLED` である, THEN THE Payment_Updater SHALL `UNPAID` から `PAID` への更新を拒否し、キャンセル済みエントリーは入金済みにできないことを示すエラーを返す
16. WHERE 対象エントリーの Entry_Status が `CANCELLED` で Payment_Status が `PAID` である, THE Payment_Updater SHALL `REFUNDED` と `UNPAID` への Payment_Transition を許可する
17. IF 対象エントリーの Entry_Status が `WAITING` である, THEN THE Payment_Updater SHALL `UNPAID` から `PAID` への更新を拒否し、キャンセル待ちのエントリーは入金済みにできないことを示すエラーを返す
18. IF 更新要求が示す画面表示時点の Payment_Status が、更新実行時点で保存されている `payment_status` と異なる, THEN THE Payment_Updater SHALL 更新を適用せず、他の操作で入金状況が更新されたため再読み込みが必要であることを示すエラーを返す
19. IF 画面表示時点の Payment_Status と更新実行時点の `payment_status` が一致し、かつ更新実行時点の値が要求された変更後の値と既に等しい, THEN THE Payment_Updater SHALL `payment_status`、`paid_at`、Payment_Log を変更せず、既に更新済みであることを示す通知を返す
20. WHEN 同一内容の更新要求が連続して 2 回実行される, THE Payment_Updater SHALL 2 回目の実行後の `payment_status` と `paid_at` を 1 回目の実行後と同一に保ち、Payment_Log のレコードを 1 件のみ追加する
21. WHEN Payment_Updater が Payment_Status を更新する, THE Payment_Updater SHALL `payment_status`、`paid_at`、Payment_Log の追加を同一トランザクションで実行する
22. IF Payment_Status の更新処理が途中で失敗する, THEN THE Payment_Updater SHALL `payment_status`、`paid_at`、Payment_Log を更新前の状態に保持し、更新失敗を示すエラーを呼び出し元へ返す
23. WHEN Payment_Status の更新が成功する, THE Payment_Updater SHALL エントリーID、変更前の Payment_Status、変更後の Payment_Status、変更した Admin_User の `users.id`、JST の変更日時を Payment_Log に 1 件記録する
24. WHEN Payment_Status の更新が成功する, THE Entry_Status_Viewer SHALL 画面の再読み込みなしに 1 秒以内に、該当行の Payment_Status と Paid_At の表示、および Payment_Status ごとの件数の表示を更新後の値へ更新する
25. WHILE Payment_Status で絞り込みが指定されている, THE Entry_Status_Viewer SHALL 更新成功後も絞り込み条件とページ番号を保持する
26. WHEN Payment_Status の更新が成功または失敗する, THE Payment_Updater SHALL Requirement 12 の基準 8 に従い、成功時は更新後の Payment_Status を示すトースト通知、失敗時は失敗理由を示すトースト通知を表示する
27. WHEN Admin_User が確認ダイアログで「更新する」を選択する, THE Payment_Updater SHALL 100ms 以内に「更新する」ボタンと同一エントリー行の更新操作要素を無効化し、処理の完了時に無効化を解除し、1 回の確認につき更新要求を 1 回のみ送信する
28. IF 指定されたエントリーが存在しない、または指定された大会に属さない, THEN THE Payment_Updater SHALL データを変更せず、対象が存在しないことを示すエラーを返す
29. THE Payment_Updater SHALL 更新対象のエントリー ID、変更後の Payment_Status、画面表示時点の Payment_Status を SQL 文字列へ連結せず、バインド変数として渡す
30. IF 変更後の Payment_Status が `UNPAID`、`PAID`、`REFUNDED` 以外である, THEN THE Payment_Updater SHALL データを変更せず、許可されていない値であることを示すエラーを返す
31. THE Payment_Updater SHALL 複数エントリーの Payment_Status を 1 回の操作で更新する一括更新を提供せず、1 回の操作で 1 エントリーのみを更新対象とする