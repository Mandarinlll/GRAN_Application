# Requirements Document

## Introduction

管理コンソール（`/admin`）に「ユーザ・チーム管理」機能を追加する。対象は `docs/requirements-detail-administrator.md` の 1.3（アカウント管理・強制操作・権限設定）、5.3 のうち初期レベル査定（`is_level_calibrated` の更新）、および `docs/requirements-detail-user.md` の 1.4（アカウントロックの管理者による手動解除）と 4.1・4.2（チーム管理）に対応する管理者側の運用操作である。

現行リポジトリでは、サイドバー項目 `users-teams`（`/admin/users`、`src/features/admin/utils/navConfig.ts`）が `implemented: false` であり、画面が存在しない。権限は `src/features/admin/utils/permissions.ts` の定義に従い、`accounts.manage` と `roles.manage`（いずれも ADMIN のみ）で本機能のすべての操作と閲覧を制御する。OPERATOR にはサイドバー項目も画面も提供しない。データは `src/lib/db.ts` の `users` / `teams` / `team_members` / `team_invitations` / `entries` / `entry_members` テーブル（SQLite、日時は JST 文字列）を使用する。UI は `docs/ui-design-system.md` に従う。

本機能の範囲には、管理者操作の監査用に `admin_account_logs` テーブルを `CREATE TABLE IF NOT EXISTS` で新設するスキーマ変更を含める。あわせて `docs/db-schema.md` の ER 図とテーブル定義を更新する。

対象外: 一般ユーザーによる新規登録・プロフィール編集・チーム作成・招待の操作（実装済みのユーザー向け機能）、退会機能（実装予定なし）、メール認証、2要素認証、GRANレベルの試合結果に基づく自動変動（Elo）、CSV 出力、ユーザー・チームの一括登録、管理者によるチーム新規作成、管理者によるチーム名・アイコンの編集、OPERATOR 向けのユーザー・チーム閲覧。

## Glossary

- **Admin_Console**: `/admin` 配下の管理コンソール Web 画面群
- **User_Manager**: 管理コンソール内でユーザーアカウントの一覧・詳細・作成・停止・ロック解除・パスワード再発行・権限変更・初期レベル査定・削除を行う機能
- **Team_Manager**: 管理コンソール内でチームの一覧・詳細表示、メンバー除名、チーム解散を行う機能
- **Admin_User**: `users.role` が `ADMIN` のログインユーザー（`accounts.manage` 権限と `roles.manage` 権限を持つ）。`is_admin` が真のアカウントも Admin_User として扱う
- **Operator_User**: `users.role` が `OPERATOR` のログインユーザー（`accounts.manage` 権限と `roles.manage` 権限を持たない）
- **Target_User**: 管理操作の対象となる `users` の 1 レコード
- **Account_Status**: `users.status` の値。`ACTIVE`（有効）、`SUSPENDED`（停止）、`PROVISIONAL`（仮登録）
- **User_Role**: `users.role` の値。`ADMIN`、`OPERATOR`、`LEADER`、`USER`
- **Account_Lock**: `users.failed_login_attempts` が 10 以上であるか `users.locked_until` が現在日時（JST）より後であるために、正しいパスワードでもログインが拒否されている状態
- **Declared_Class**: `users.declared_class` の値。自己申告階級（`A`、`AB`、`B`、`BC`、`C`、`CD`、`D`、`DE`）
- **Gran_Level**: `users.gran_level`（100 以上 999 以下の整数）
- **Calibration_Range**: 階級ごとの査定基準レンジ。A: 850〜999、AB: 750〜870、B: 650〜770、BC: 550〜670、C: 450〜570、CD: 350〜470、D: 250〜370、DE: 100〜270
- **Level_Calibrator**: Admin_User が Target_User の Gran_Level を査定し `is_level_calibrated` を更新する機能
- **Uncalibrated_User**: `users.is_level_calibrated` が偽のユーザー
- **Initial_Password**: Admin_User によるアカウント作成またはパスワード再発行時にシステムが生成する 12 文字以上の英数字の仮パスワード
- **Team**: `teams` テーブルの 1 レコードで表すチーム
- **Team_Leader**: `teams.leader_user_id` が指すユーザー
- **Team_Member_Record**: `team_members` テーブルの 1 レコード。Team_Leader 自身の所属レコードを含む
- **Active_Team_Entry**: Team の `team_id` を持ち、`entries.status` が `CONFIRMED` または `WAITING` であるエントリー
- **Active_Personal_Entry**: Target_User を `entries.user_id` に持つ、または `entry_members.user_id` に持つエントリーのうち、`entries.status` が `CONFIRMED` または `WAITING` のもの
- **Admin_Account_Log**: 管理者によるユーザー・チーム操作の履歴を記録する `admin_account_logs` テーブルの 1 レコード。操作種別、対象種別（`USER` または `TEAM`）、対象 ID、操作者の `users.id`、操作の詳細（JSON 文字列）、操作日時（JST）を持つ
- **Session_Revoker**: Target_User の既存ログインセッション（Refresh Token）を失効させる既存のサーバー側機能
- **Notification_Service**: 通知を生成し `notification_logs` に記録する既存のサーバー側機能
- **Unified_Error**: 処理失敗を呼び出し元へ返す共通のエラー表現（権限不足、認証必要、対象なし、入力不正、競合の種別を持つ）

## Requirements

### Requirement 1: ユーザー・チーム管理画面へのアクセス制御

**User Story:** As an Admin_User, I want ユーザー・チーム管理画面に管理者だけがアクセスできるようにしたい, so that 個人情報とアカウント操作が権限のない人に使われない。

#### Acceptance Criteria

1. THE Admin_Console SHALL ユーザー一覧画面を `/admin/users` で、チーム一覧画面を `/admin/teams` で提供する
2. WHILE ログイン中のユーザーが Admin_User である, THE Admin_Console SHALL サイドバーの「ユーザ・チーム管理」項目を、`/admin/users` へ遷移する有効なリンクとして表示する
3. WHILE ログイン中のユーザーが Admin_User ではない, THE Admin_Console SHALL サイドバーに「ユーザ・チーム管理」項目を表示しない
4. WHEN 未ログインのユーザーが `/admin/users` または `/admin/teams` 配下の画面を開く, THE Admin_Console SHALL 画面内容（ユーザー情報・チーム情報を含む）を一切表示せずにログイン画面へ遷移させる
5. WHEN Operator_User または `role` が `USER` もしくは `LEADER` のユーザーが `/admin/users` または `/admin/teams` 配下の画面を開く, THE Admin_Console SHALL 画面内容（ユーザー情報・チーム情報を含む）を一切表示せずに 404 応答を返す
6. WHEN ユーザー・チーム管理のサーバー処理（閲覧・作成・更新・削除のいずれか）が呼び出される, THE User_Manager SHALL 処理の実行前に、DB 上の最新の `role` と `status` に基づいて呼び出しユーザーが `accounts.manage` 権限を持つかを検証する
7. IF 呼び出しユーザーが `accounts.manage` 権限を持たない（`status` が無効な場合を含む）, THEN THE User_Manager SHALL データの変更および取得を行わず、権限不足を示す Unified_Error を呼び出し元へ返す
8. IF 未ログインのユーザーがユーザー・チーム管理のサーバー処理を直接呼び出す, THEN THE User_Manager SHALL データの変更および取得を行わず、認証が必要であることを示す Unified_Error を呼び出し元へ返す
9. WHEN User_Role の変更を実行する処理が呼び出される, THE User_Manager SHALL 処理の実行前に、DB 上の最新の `role` と `status` に基づいて呼び出しユーザーが `roles.manage` 権限を持つかを検証する
10. IF User_Role の変更を呼び出したユーザーが `roles.manage` 権限を持たない, THEN THE User_Manager SHALL User_Role を変更せず、権限不足を示す Unified_Error を呼び出し元へ返す

### Requirement 2: ユーザー一覧の表示と絞り込み

**User Story:** As an Admin_User, I want 登録済みユーザーを一覧で検索したい, so that 問い合わせ対象のアカウントをすばやく見つけられる。

#### Acceptance Criteria

1. WHEN ユーザー一覧画面が表示される, THE User_Manager SHALL 各ユーザーについて、ユーザーID（`login_id`）、氏名（`real_name`）、ニックネーム、メールアドレス、User_Role、Account_Status、Gran_Level、Declared_Class、Account_Lock の有無、初期レベル査定の済・未済を 1 行に表示する
2. WHEN ユーザー一覧画面が表示される, THE User_Manager SHALL ユーザーを `login_id` の昇順で、1 ページ 50 件で表示する
3. WHEN ユーザー一覧の総件数が 50 件を超える, THE User_Manager SHALL ページ送りの操作要素と、現在の表示範囲（例: 「51–100 件目」）および総件数を表示する
4. WHEN Admin_User が検索語（1 文字以上 100 文字以下）を入力する, THE User_Manager SHALL 氏名、フリガナ、ニックネーム、メールアドレス、`login_id` のいずれかに検索語を含むユーザーのみを、大文字小文字を区別せずに表示し、表示開始位置を 1 ページ目に戻す
5. WHEN Admin_User が User_Role、Account_Status、Declared_Class のいずれかを選択する, THE User_Manager SHALL 選択された値に一致するユーザーのみを表示し、表示開始位置を 1 ページ目に戻す
6. WHEN Admin_User が「ロック中のみ」を選択する, THE User_Manager SHALL Account_Lock 状態のユーザーのみを表示する
7. WHEN Admin_User が「未査定のみ」を選択する, THE User_Manager SHALL Uncalibrated_User のみを表示する
8. WHILE 複数の絞り込み条件（検索語を含む）が指定されている, THE User_Manager SHALL すべての条件を AND で満たすユーザーのみを表示し、総件数とページ数を絞り込み後の件数に基づいて表示する
9. IF 絞り込み条件に一致するユーザーが 0 件である, THEN THE User_Manager SHALL 該当するユーザーがない旨のメッセージを表示し、指定中の絞り込み条件を保持し、条件を解除する操作要素を表示する
10. IF 検索語が 100 文字を超える, THEN THE User_Manager SHALL 検索語の長さが上限を超えている旨のエラーを表示し、直前に表示していた一覧を変更しない
11. THE User_Manager SHALL ユーザー一覧に `password_hash` を含めない
12. WHEN ユーザー一覧の行が選択される, THE User_Manager SHALL そのユーザーの詳細画面を `/admin/users/{id}` に表示する
13. THE User_Manager SHALL 一覧と詳細の日時・数値の表示に `tabular-nums` を適用する

### Requirement 3: ユーザー詳細の表示

**User Story:** As an Admin_User, I want 1 人のユーザーの登録情報と所属状況を確認したい, so that 問い合わせに対して判断と操作ができる。

#### Acceptance Criteria

1. WHEN ユーザー詳細画面が表示される, THE User_Manager SHALL `login_id`、メールアドレス、氏名、フリガナ、ニックネーム、性別、生年月日、電話番号、Declared_Class、Gran_Level、初期レベル査定の済・未済、`rated_match_count`、User_Role、Account_Status、`failed_login_attempts`、`locked_until`、`last_login_at`、`created_at` を表示する。値が未設定の項目は空欄ではなく「未設定」と表示する
2. WHEN ユーザー詳細画面が表示される, THE User_Manager SHALL Target_User が代表を務める Team の名称（代表を務める Team がない場合は「なし」）と、Target_User が所属している Team の一覧（各 Team の名称と代表者のニックネーム）を表示する。所属 Team が 0 件の場合は「所属チームなし」と表示する
3. WHEN ユーザー詳細画面が表示される, THE User_Manager SHALL Target_User の Active_Personal_Entry の件数を 0 以上の整数で表示する
4. WHEN ユーザー詳細画面が表示される, THE User_Manager SHALL 当該ユーザーに対する Admin_Account_Log を `created_at` の降順で最大 20 件表示する。該当ログが 0 件の場合は「操作履歴なし」と表示する
5. THE User_Manager SHALL ユーザー詳細の表示内容およびレスポンスに `password_hash` を含めない
6. IF 指定された `id` のユーザーが存在しない, THEN THE Admin_Console SHALL 404 応答を返し、ユーザー詳細の情報を一切表示しない
7. IF ユーザー詳細の取得中にデータベースエラーが発生する, THEN THE Admin_Console SHALL 取得に失敗したことを示すエラーメッセージを表示し、部分的なユーザー情報を表示しない

### Requirement 4: ユーザーアカウントの新規作成

**User Story:** As an Admin_User, I want テスト用や代理用のアカウントを管理画面から作成したい, so that アプリ未登録の参加者を管理者が登録できる。

#### Acceptance Criteria

1. WHEN Admin_User がアカウント作成画面を開く, THE User_Manager SHALL メールアドレス、氏名、フリガナ、ニックネーム、性別、生年月日、電話番号、Declared_Class、Gran_Level、User_Role の入力欄を表示し、メールアドレス、氏名、フリガナ、ニックネーム、電話番号、Declared_Class に必須であることを示す表示を付ける
2. WHEN Admin_User が必須項目をすべて有効な値で入力して作成を実行する, THE User_Manager SHALL 新しい UUID を `users.id` として採番し、既存の最大値の次の 6 桁数字（`000101` 以上、`999999` 以下）を `login_id` として採番し、ユーザーを保存する
3. WHEN ユーザーが保存される, THE User_Manager SHALL Initial_Password を生成し、bcrypt でハッシュ化した値を `password_hash` に保存し、`is_initial_login` を偽、`status` を `ACTIVE` に設定する
4. WHEN ユーザーの保存が成功する, THE User_Manager SHALL 成功メッセージと Initial_Password を作成直後の 1 回に限り画面に表示し、以降の画面では Initial_Password を再表示しない
5. WHEN Gran_Level が未入力で作成が実行される, THE User_Manager SHALL Declared_Class の Calibration_Range の中央値（小数点以下切り捨て）を Gran_Level に設定し、`is_level_calibrated` を偽にする
6. WHEN Gran_Level が入力されて作成が実行される, THE User_Manager SHALL 入力された Gran_Level を保存し、`is_level_calibrated` を真にする
7. WHEN User_Role が未指定で作成が実行される, THE User_Manager SHALL User_Role を `USER` として保存する
8. WHEN ユーザーが保存される, THE User_Manager SHALL `created_at` と `updated_at` に同一の JST の現在日時を設定し、Admin_Account_Log に操作種別 `USER_CREATED` を記録する
9. IF 必須項目のいずれかが未入力（空文字または空白のみを含む）である, THEN THE User_Manager SHALL ユーザーを保存せずに、未入力の項目ごとに、その入力欄の近くに未入力であることを示すエラーメッセージを表示する
10. IF メールアドレスの形式が不正または 255 文字を超える, THEN THE User_Manager SHALL ユーザーを保存せずに、メールアドレスの入力欄に形式または最大文字数を示すエラーメッセージを表示する
11. IF 入力されたメールアドレスが既存ユーザーの `email` と大文字小文字を区別せずに一致する, THEN THE User_Manager SHALL ユーザーを保存せずに、メールアドレスの入力欄に登録済みであることを示すエラーメッセージを表示する
12. IF 氏名、フリガナ、ニックネームのいずれかが 40 文字を超える, THEN THE User_Manager SHALL ユーザーを保存せずに、該当する入力欄に最大文字数（40 文字）を示すエラーメッセージを表示する
13. IF 電話番号が数字とハイフンのみで構成された 10 文字以上 15 文字以下の文字列でない, THEN THE User_Manager SHALL ユーザーを保存せずに、電話番号の入力欄に有効な形式を示すエラーメッセージを表示する
14. IF Declared_Class が `A`、`AB`、`B`、`BC`、`C`、`CD`、`D`、`DE` 以外である, THEN THE User_Manager SHALL ユーザーを保存せずに、Declared_Class の入力欄に許可されていない値であることを示すエラーメッセージを表示する
15. IF Gran_Level が 100 以上 999 以下の整数でない, THEN THE User_Manager SHALL ユーザーを保存せずに、Gran_Level の入力欄に有効範囲（100〜999 の整数）を示すエラーメッセージを表示する
16. IF User_Role が `ADMIN`、`OPERATOR`、`LEADER`、`USER` 以外である, THEN THE User_Manager SHALL ユーザーを保存せずに、User_Role の入力欄に許可されていない値であることを示すエラーメッセージを表示する
17. IF バリデーションエラーが発生する, THEN THE User_Manager SHALL 入力済みのすべての項目の値を保持したまま作成画面を再表示し、複数のエラーが同時に発生した場合は該当するすべての項目のエラーメッセージを同時に表示する
18. IF 保存処理がデータベースエラーで失敗する, THEN THE User_Manager SHALL 保存に失敗したことを示すエラーメッセージを表示し、ユーザーを 1 件も作成せず、Admin_Account_Log も記録せず、入力済みのすべての項目の値を保持したまま作成画面を再表示する
19. IF 性別が選択肢以外の値である、または生年月日が実在しない日付もしくは作成実行日（JST）より後の日付である, THEN THE User_Manager SHALL ユーザーを保存せずに、該当する入力欄に許可されていない値または無効な日付であることを示すエラーメッセージを表示する
20. IF `login_id` の採番結果が `999999` を超える, THEN THE User_Manager SHALL ユーザーを保存せずに、採番できないことを示すエラーメッセージを表示し、入力済みのすべての項目の値を保持したまま作成画面を再表示する

### Requirement 5: アカウントロックの手動解除

**User Story:** As an Admin_User, I want ロックされたアカウントを手動で解除したい, so that 問い合わせ対応後にユーザーが再びログインできる。

#### Acceptance Criteria

1. WHILE Target_User が Account_Lock 状態である, THE User_Manager SHALL ユーザー一覧の該当行とユーザー詳細の両方に、ロック中であることを示す表示と「ロック解除」ボタンを表示する
2. WHILE Target_User が Account_Lock 状態でない, THE User_Manager SHALL ユーザー一覧の該当行とユーザー詳細に「ロック解除」ボタンを表示しない
3. WHEN Admin_User が「ロック解除」ボタンを押下する, THE User_Manager SHALL 確認ダイアログを表示し、Admin_User が「ロック解除」を確定するまでデータを変更しない
4. WHEN Admin_User が確認ダイアログで「ロック解除」を確定する, THE User_Manager SHALL Target_User の `failed_login_attempts` を 0、`locked_until` を NULL に更新する
5. WHEN ロック解除が成功する, THE User_Manager SHALL Admin_Account_Log に操作種別 `LOCK_RELEASED` を記録し、成功メッセージを表示し、ユーザー一覧とユーザー詳細の表示をロック解除後の状態に更新する
6. IF 解除対象のユーザーが Account_Lock 状態でない, THEN THE User_Manager SHALL データを変更せず、Admin_Account_Log にも記録せずに、ロック中ではないことを示す Unified_Error を返す
7. IF ロック解除の更新または Admin_Account_Log への記録が失敗する, THEN THE User_Manager SHALL `failed_login_attempts` と `locked_until` を操作前の値のまま保持し、解除に失敗したことを示す Unified_Error を返す
8. WHEN ロック解除が成功した後に Target_User が正しいパスワードでログインを試みる, THE Admin_Console SHALL 当該ログインを Account_Lock によって拒否せず、ログインを成功させる

### Requirement 6: パスワードの強制再発行

**User Story:** As an Admin_User, I want ユーザーのパスワードを強制的に再発行したい, so that パスワードを忘れたユーザーを救済できる。

#### Acceptance Criteria

1. WHEN Admin_User が確認ダイアログで「パスワード再発行」を確定する, THE User_Manager SHALL 新しい Initial_Password を生成し、bcrypt でハッシュ化した値を `password_hash` に保存する
2. WHEN パスワード再発行が成功する, THE User_Manager SHALL `is_initial_login` を偽、`failed_login_attempts` を 0、`locked_until` を NULL に更新する
3. WHEN パスワード再発行が成功する, THE Session_Revoker SHALL Target_User の既存セッションをすべて失効させ、失効後 Target_User の既存セッションを用いたリクエストが認証エラーとなる状態にする
4. WHEN パスワード再発行が成功する, THE User_Manager SHALL 新しい Initial_Password を実行直後の 1 回に限り画面に表示する
5. WHEN パスワード再発行が成功する, THE User_Manager SHALL Admin_Account_Log に操作種別 `PASSWORD_RESET`、実行した Admin_User、Target_User、実行日時を記録し、Initial_Password もそのハッシュも含めない
6. IF パスワード再発行の保存処理が失敗する, THEN THE User_Manager SHALL `password_hash`、`is_initial_login`、`failed_login_attempts`、`locked_until` を再発行前の値のまま保持し、セッションを失効させず、Initial_Password を表示せず、Admin_Account_Log に `PASSWORD_RESET` を記録せず、失敗を示すエラーメッセージを表示する
7. IF Admin_User が確認ダイアログで「パスワード再発行」をキャンセルする, THEN THE User_Manager SHALL `password_hash` とセッションを変更せず、Initial_Password を生成しない
8. THE User_Manager SHALL 実行ごとに他の実行と異なる Initial_Password を生成する

### Requirement 7: アカウントの停止と再開

**User Story:** As an Admin_User, I want 不正なユーザーのアカウントを停止し、必要なら再開したい, so that 問題のあるユーザーによるログインを防ぎつつ、データを保持できる。

#### Acceptance Criteria

1. WHEN Admin_User が確認ダイアログで `status` が `ACTIVE` のユーザーの「停止」を確定する, THE User_Manager SHALL Target_User の `status` を `SUSPENDED` に更新し、Target_User のユーザーデータ（プロフィール、エントリー履歴を含む）を削除せずに保持する
2. WHEN アカウントの停止が成功する, THE Session_Revoker SHALL Target_User の既存セッションをすべて失効させ、失効後 5 秒以内に Target_User の次のリクエストを認証エラーにする
3. WHEN Admin_User が確認ダイアログで `status` が `SUSPENDED` のユーザーの「再開」を確定する, THE User_Manager SHALL Target_User の `status` を `ACTIVE` に更新する
4. WHEN 停止または再開が成功する, THE User_Manager SHALL 操作種別 `ACCOUNT_SUSPENDED` または `ACCOUNT_REACTIVATED`、操作した Admin_User、Target_User、操作日時を Admin_Account_Log に記録し、成功メッセージを表示する
5. IF 操作対象が Admin_User 自身のアカウントである, THEN THE User_Manager SHALL `status` とセッションを変更せずに、自分自身は停止できないことを示す Unified_Error を返し、Admin_Account_Log に記録しない
6. IF 停止の結果、`status` が `ACTIVE` の Admin_User が 0 人になる, THEN THE User_Manager SHALL `status` とセッションを変更せずに、最後の管理者は停止できないことを示す Unified_Error を返し、Admin_Account_Log に記録しない
7. IF 停止の対象ユーザーの `status` が `ACTIVE` でない、または再開の対象ユーザーの `status` が `SUSPENDED` でない, THEN THE User_Manager SHALL `status` とセッションを変更せずに、現在の状態では実行できないことを示す Unified_Error を返し、Admin_Account_Log に記録しない
8. WHILE Target_User の `status` が `SUSPENDED` である, THE Admin_Console SHALL ユーザー一覧の該当行とユーザー詳細画面に、「停止中」というテキストラベルを表示する
9. IF `status` の更新、セッションの失効、または Admin_Account_Log への記録のいずれかが失敗する, THEN THE User_Manager SHALL すべての変更を取り消して `status` を操作前の値に戻し、操作が完了しなかったことを示す Unified_Error を返す

### Requirement 8: 権限（User_Role）の変更

**User Story:** As an Admin_User, I want ユーザーの権限を切り替えたい, so that 運営者や管理者を任命・解任できる。

#### Acceptance Criteria

1. WHEN Admin_User がユーザー詳細で User_Role を選択して確認ダイアログで確定する, THE User_Manager SHALL Target_User の `role` を選択された値に更新し、`is_admin` を、選択値が `ADMIN` の場合は真、それ以外の場合は偽に更新する
2. WHEN User_Role の更新が成功する, THE Session_Revoker SHALL 更新成功から 5 秒以内に Target_User の既存セッションをすべて失効させ、失効後の Target_User の既存セッションによるリクエストは認証されない状態にする
3. WHEN User_Role の更新が成功する, THE User_Manager SHALL Admin_Account_Log に操作種別 `ROLE_CHANGED`、操作した Admin_User、Target_User、変更前の User_Role、変更後の User_Role を記録し、成功メッセージを表示する
4. IF 操作対象が Admin_User 自身のアカウントである, THEN THE User_Manager SHALL データを変更せず、セッションを失効させず、Admin_Account_Log に記録せず、自分自身の権限は変更できないことを示す Unified_Error を返す
5. IF 選択された User_Role が `ADMIN`、`OPERATOR`、`LEADER`、`USER` 以外である, THEN THE User_Manager SHALL データを変更せず、セッションを失効させず、Admin_Account_Log に記録せず、許可されていない値であることを示す Unified_Error を返す
6. IF 選択された User_Role が `LEADER` であり、かつ Target_User が Team の Team_Leader でない, THEN THE User_Manager SHALL データを変更せず、セッションを失効させず、Admin_Account_Log に記録せず、代表者の権限はチーム作成によって付与されることを示す Unified_Error を返す
7. IF 選択された User_Role が Target_User の現在の User_Role と同一である, THEN THE User_Manager SHALL データを変更せず、セッションを失効させず、Admin_Account_Log に記録せず、変更がないことを示す Unified_Error を返す
8. IF Target_User が Team の Team_Leader であり、選択された User_Role が `USER` である, THEN THE User_Manager SHALL データを変更せず、セッションを失効させず、Admin_Account_Log に記録せず、チームの代表者は `LEADER` または管理系の権限を保持する必要があることを示す Unified_Error を返す
9. IF User_Role の更新、セッション失効、または Admin_Account_Log への記録のいずれかが失敗する, THEN THE User_Manager SHALL 3 つの処理すべての結果を更新前の状態に戻し、Target_User の `role` と `is_admin` を変更前の値のまま保持し、処理に失敗したことを示す Unified_Error を返す

### Requirement 9: 初期レベル査定

**User Story:** As an Admin_User, I want 自己申告をもとにユーザーの GRANレベルを査定したい, so that 大会運営で実力に応じた扱いができる。

#### Acceptance Criteria

1. WHEN Admin_User が「未査定のみ」で絞り込む, THE Level_Calibrator SHALL `is_level_calibrated` が偽である Uncalibrated_User のみを、`created_at` の昇順（登録が古い順）で表示する。`created_at` が同一の場合は、ユーザー ID の昇順で表示する
2. IF 「未査定のみ」の絞り込み結果が 0 件である, THEN THE Level_Calibrator SHALL 該当ユーザーがいないことを示す空状態メッセージを表示する
3. WHEN Admin_User が Uncalibrated_User の査定画面を開く, THE Level_Calibrator SHALL Declared_Class、現在の Gran_Level、Declared_Class に対応する Calibration_Range（下限値と上限値）を表示する
4. WHEN Admin_User が 100 以上 999 以下の整数の Gran_Level を入力して確定する, THE Level_Calibrator SHALL Target_User の `gran_level` を入力値に更新し、`is_level_calibrated` を真に更新する
5. WHEN 入力された Gran_Level が 100 以上 999 以下の整数であり、かつ Declared_Class の Calibration_Range の外である, THE Level_Calibrator SHALL 申告階級のレンジ外であることを示す警告を表示し、データを変更せずに Admin_User の再確定を待つ。Admin_User が入力値を変更せずに再度確定した場合にのみ更新を実行する
6. WHEN 査定が成功する, THE Level_Calibrator SHALL Admin_Account_Log に、変更前の Gran_Level、変更後の Gran_Level、操作を行った Admin_User、Target_User を含む操作種別 `LEVEL_CALIBRATED` を記録し、成功メッセージを表示する
7. WHERE Target_User が査定済み（`is_level_calibrated` が真）である, THE Level_Calibrator SHALL 同じ画面から Gran_Level の再査定（手動オーバーライド）を受け付け、更新時に操作種別 `LEVEL_CALIBRATED` として、変更前の Gran_Level と変更後の Gran_Level を含めて記録する
8. IF 入力された Gran_Level が 100 以上 999 以下の整数でない（空欄、小数、非数値、範囲外の値を含む）, THEN THE Level_Calibrator SHALL `gran_level` と `is_level_calibrated` を変更せず、Admin_Account_Log にも記録せずに、Gran_Level の入力欄に有効範囲（100〜999 の整数）を示すエラーメッセージを表示し、入力値を保持する
9. IF 更新または Admin_Account_Log への記録が失敗する, THEN THE Level_Calibrator SHALL `gran_level` と `is_level_calibrated` を更新前の値に保持（ロールバック）し、査定に失敗したことを示すエラーメッセージを表示する

### Requirement 10: ユーザーの削除

**User Story:** As an Admin_User, I want 退会希望者や不正ユーザーのアカウントを削除したい, so that 不要なアカウントを整理できる。

#### Acceptance Criteria

1. WHEN Admin_User が削除確認ダイアログでユーザーの `login_id` を入力して「削除」を確定する, THE User_Manager SHALL 入力値が Target_User の `login_id` と大文字小文字を区別して完全一致する場合に限り、Target_User を `users` から削除する
2. IF 入力された `login_id` が Target_User の `login_id` と完全一致しない（空文字列、前後の空白のみの差異、大文字小文字のみの差異を含む）, THEN THE User_Manager SHALL データを変更せず、削除確認ダイアログを開いたまま、一致しないことを示すエラーメッセージを表示する
3. IF Target_User が Team の Team_Leader である, THEN THE User_Manager SHALL データを変更せず、先にチームを解散する必要があることを示す Unified_Error を返す
4. IF Target_User の Active_Personal_Entry が 1 件以上存在する, THEN THE User_Manager SHALL データを変更せず、先に大会のエントリーをキャンセルする必要があることを示す Unified_Error を返す
5. IF 操作対象が Admin_User 自身のアカウントである, THEN THE User_Manager SHALL データを変更せず、自分自身は削除できないことを示す Unified_Error を返す
6. IF 削除の結果、`role` が `ADMIN` かつ `status` が `ACTIVE` のユーザーが 0 人になる, THEN THE User_Manager SHALL データを変更せず、最後の管理者は削除できないことを示す Unified_Error を返す
7. WHEN 削除が成功する, THE Session_Revoker SHALL Target_User の既存セッションをすべて失効させ、失効後 Target_User が既存セッションでリクエストした場合は認証エラーとなる状態にする
8. WHEN 削除が成功する, THE User_Manager SHALL Target_User に紐づく `team_members`、`team_invitations`、`inbox_notifications` のレコードを、`users` レコードの削除と同一トランザクション内で削除する
9. WHEN 削除が成功する, THE User_Manager SHALL 同一トランザクション内で、削除したユーザーの `login_id` と氏名を詳細に含む操作種別 `USER_DELETED` を Admin_Account_Log に 1 件記録する
10. WHEN 削除が成功する, THE User_Manager SHALL ユーザー一覧へ遷移し、削除が完了したことを示す成功メッセージを表示する
11. IF 削除処理がデータベースエラーで失敗する, THEN THE User_Manager SHALL `users`、`team_members`、`team_invitations`、`inbox_notifications` のいずれのレコードも削除せず（ロールバック）、Admin_Account_Log も記録せず、Target_User のセッションを失効させず、削除に失敗したことを示すエラーメッセージを表示する

### Requirement 11: チーム一覧とチーム詳細の表示

**User Story:** As an Admin_User, I want 全チームとその構成メンバーを確認したい, so that 大会運営やユーザーからの問い合わせに対応できる。

#### Acceptance Criteria

1. WHEN チーム一覧画面が表示される, THE Team_Manager SHALL 各チームについて、チーム名、代表者の氏名とニックネーム、所属メンバー数、Active_Team_Entry の件数、作成日時を 1 行に表示する
2. WHEN チーム一覧画面が表示される, THE Team_Manager SHALL チームを作成日時の降順で、1 ページ 50 件で表示する
3. WHEN Admin_User が検索語（1 文字以上 100 文字以下）を入力する, THE Team_Manager SHALL チーム名または代表者の氏名・ニックネームに検索語を含むチームのみを、大文字小文字を区別せずに、作成日時の降順、1 ページ 50 件で表示する
4. IF 検索条件に一致するチームが 0 件である, THEN THE Team_Manager SHALL 該当するチームがない旨のメッセージを表示し、指定中の検索語を入力欄に保持する
5. WHEN チーム一覧の行が選択される, THE Team_Manager SHALL そのチームの詳細画面を `/admin/teams/{id}` に表示する
6. WHEN チーム詳細画面が表示される, THE Team_Manager SHALL チーム名、アイコン、代表者、所属メンバー全員（氏名、ニックネーム、Gran_Level、参加日時 `joined_at`）、Active_Team_Entry の一覧（大会名、開催日、Entry_Status）、保留中（`PENDING`）のチーム招待の一覧（招待先のニックネームと招待日時）を表示する
7. IF チーム詳細画面で表示対象の Active_Team_Entry、保留中のチーム招待、またはアイコンが存在しない, THEN THE Team_Manager SHALL 該当する一覧に対して、該当する項目がない旨のメッセージを表示するか、アイコンの場合は既定の代替表示を行う
8. WHEN ユーザー詳細の所属チーム名が選択される, THE Admin_Console SHALL そのチームの詳細画面へ遷移する
9. WHEN チーム詳細の所属メンバー名が選択される, THE Admin_Console SHALL そのユーザーの詳細画面へ遷移する
10. IF 指定された `id` のチームが存在しない, THEN THE Admin_Console SHALL 404 応答を返し、チーム詳細の内容を表示しない

### Requirement 12: チームからのメンバー除名

**User Story:** As an Admin_User, I want 管理者としてチームのメンバーを除名したい, so that 代表者と連絡がつかない場合や不正メンバーに対応できる。

#### Acceptance Criteria

1. WHEN Admin_User が確認ダイアログでチーム詳細の所属メンバーの「除名」を確定する, THE Team_Manager SHALL 対象の Team_Member_Record の削除、当該ユーザーに対する当該チームの保留中の招待の状態の `CANCELLED` への更新、および Admin_Account_Log への記録を単一のトランザクションとして実行する
2. WHEN 除名が成功する, THE Team_Manager SHALL Admin_Account_Log に、Team の ID と除名したユーザーの ID を詳細に含む操作種別 `TEAM_MEMBER_REMOVED` の記録を 1 件追加し、成功メッセージを表示する
3. WHEN 除名が成功する, THE Notification_Service SHALL 除名されたユーザーの通知受信箱へ、チームから除名された旨の通知を 1 件登録する
4. IF 除名対象のユーザーが Team の Team_Leader である, THEN THE Team_Manager SHALL データを変更せずに、代表者は除名できないことを示す Unified_Error を返す
5. IF 除名対象のユーザーが Team の Team_Member_Record を持たない, THEN THE Team_Manager SHALL データを変更せずに、所属していないことを示す Unified_Error を返す
6. IF 除名対象のユーザーが、その Team の Active_Team_Entry の `entry_members` に `REGISTERED` として割り当てられている, THEN THE Team_Manager SHALL データを変更せずに、エントリーのメンバー構成から先に外す必要があることを示す Unified_Error を返す
7. IF 除名処理中にデータベースエラーが発生し Team_Member_Record の削除、招待の更新、または Admin_Account_Log への記録のいずれかが失敗する, THEN THE Team_Manager SHALL すべての変更をロールバックし、通知を登録せず、除名に失敗したことを示す Unified_Error を返す

### Requirement 13: チームの解散

**User Story:** As an Admin_User, I want 不要になったチームを解散させたい, so that 代表者のアカウント削除や権限整理の前提を整えられる。

#### Acceptance Criteria

1. WHEN Admin_User が解散確認ダイアログでチーム名を入力して「解散」を確定する, THE Team_Manager SHALL 入力値が Team の `name` と完全一致（大文字小文字を区別し、前後の空白を除去せずに比較）する場合に限り、Team を `teams` から削除する
2. IF 入力されたチーム名が Team の `name` と一致しない（空文字を含む）, THEN THE Team_Manager SHALL Team・`team_members`・`team_invitations` を変更せず、解散確認ダイアログを開いたままチーム名が一致しないことを示すエラーメッセージを表示する
3. IF Team に Active_Team_Entry が 1 件以上存在する, THEN THE Team_Manager SHALL Team・`team_members`・`team_invitations` を変更せずに、先に大会のエントリーをキャンセルする必要があることを示す Unified_Error を返す
4. WHEN 解散が成功する, THE Team_Manager SHALL Team に紐づく `team_members` と `team_invitations` のすべてのレコードを、Team の削除と同一トランザクション内で削除する
5. WHEN 解散が成功する, THE Team_Manager SHALL 解散前の所属メンバー全員（Team_Leader を含む）の通知受信箱へ、チームが解散された旨の通知を 1 人につき 1 件登録する
6. WHEN 解散が成功し、元の Team_Leader の `role` が `LEADER` であり、かつ元の Team_Leader が他に代表を務める Team を持たない, THE Team_Manager SHALL 元の Team_Leader の `role` を、Team の削除と同一トランザクション内で `USER` に更新する
7. WHEN 解散が成功する, THE Team_Manager SHALL Admin_Account_Log に操作種別 `TEAM_DISBANDED` として、詳細に解散した Team 名と解散時のメンバー数（Team_Leader を含む）を記録する
8. WHEN 解散が成功する, THE Team_Manager SHALL チーム一覧へ遷移し、チームを解散した旨の成功メッセージを表示する
9. IF 解散処理がデータベースエラーで失敗する, THEN THE Team_Manager SHALL Team・`team_members`・`team_invitations`・元の Team_Leader の `role` を解散前の状態に保ち、通知も Admin_Account_Log も登録せず、解散に失敗したことを示すエラーメッセージを表示する
10. WHEN 解散が成功する, THE Team_Manager SHALL 解散した Team の過去エントリー・戦績データを保持しない（`docs/requirements-detail-user.md` 4.1）

### Requirement 14: 管理操作の監査ログ

**User Story:** As an Admin_User, I want ユーザー・チームに対する管理操作の履歴を残したい, so that 誰がいつ何をしたかを後から確認できる。

#### Acceptance Criteria

1. THE User_Manager SHALL `admin_account_logs` テーブルを `CREATE TABLE IF NOT EXISTS` で `src/lib/db.ts` に定義し、`id`（TEXT、PK）、`action`（TEXT、NOT NULL、最大 50 文字。`USER_CREATED` などの操作種別を表す文字列）、`target_type`（`USER` または `TEAM` の CHECK 制約、NOT NULL）、`target_id`（TEXT、NOT NULL）、`operator_user_id`（TEXT、NOT NULL、`users(id)` 参照）、`detail`（TEXT、NULL 許容、最大 2,000 文字）、`created_at`（TEXT、NOT NULL、JST、`YYYY-MM-DD HH:mm:ss` 形式）の列を持たせる
2. THE User_Manager SHALL `admin_account_logs.operator_user_id` の外部キーを `ON DELETE RESTRICT` として定義する
3. IF `admin_account_logs` に 1 件以上の記録を持つ `operator_user_id` のユーザーの削除が要求される, THEN THE User_Manager SHALL そのユーザーの削除を拒否し、当該ユーザーおよび既存のログ行を変更せず、削除不可を示す Unified_Error を返す
4. WHEN ユーザーまたはチームの作成・更新・削除の操作が成功する, THE User_Manager SHALL 当該操作のデータ変更と Admin_Account_Log の 1 件の記録を同一トランザクションで確定する
5. IF Admin_Account_Log の記録に失敗する, THEN THE User_Manager SHALL 同一トランザクション内のデータ変更をすべてロールバックし、失敗を示す Unified_Error を返す
6. THE User_Manager SHALL Admin_Account_Log の `detail` に `password_hash`、Initial_Password、セッショントークンを含めない
7. THE User_Manager SHALL `admin_account_logs` へのインデックス `idx_admin_account_logs_target ON admin_account_logs(target_type, target_id, created_at DESC)` を作成する
8. WHEN `docs/db-schema.md` が更新される, THE User_Manager SHALL ER 図と `admin_account_logs` のテーブル定義（3.x）、追加インデックスの説明を同ドキュメントに追記する

### Requirement 15: 確認ダイアログと操作結果の表示

**User Story:** As an Admin_User, I want 取り消しにくい操作の前に確認を求められ、結果が分かりやすく表示されてほしい, so that 誤操作を防ぎ結果を確実に把握できる。

#### Acceptance Criteria

1. WHEN Admin_User がロック解除、パスワード再発行、停止、再開、権限変更、削除、メンバー除名、チーム解散のいずれかの操作要素を選択する, THE Admin_Console SHALL 操作対象の名称、操作の種類、および確定ボタンと取り消しボタンを含む確認ダイアログを表示する
2. WHILE 確認ダイアログが表示されており Admin_User が確定を選択していない, THE Admin_Console SHALL サーバー処理を呼び出さない
3. WHEN Admin_User が確認ダイアログで取り消しを選択する, THE Admin_Console SHALL データを変更せず、サーバー処理を呼び出さずに、ダイアログを閉じる
4. WHEN Admin_User が確認ダイアログで確定を選択する, THE Admin_Console SHALL 対象の操作に対するサーバー処理を 1 回だけ呼び出す
5. WHILE 操作のサーバー処理が実行中である, THE Admin_Console SHALL 確認ダイアログの確定ボタンを無効化し、追加の確定操作によるサーバー処理の呼び出しを 0 件にする
6. WHEN サーバー処理が成功する, THE Admin_Console SHALL 確認ダイアログを閉じ、操作が成功したことを示す日本語の成功メッセージを表示し、3 秒以内に画面の表示内容を更新後のデータに更新する
7. IF サーバー処理が Unified_Error を返す, THEN THE Admin_Console SHALL 確認ダイアログを閉じ、Unified_Error の種別（入力不正、権限不足、対象なし、競合、サーバー内部エラー）ごとに、失敗した操作と原因を示す日本語のエラーメッセージを表示し、画面の表示内容を変更しない
8. IF サーバー処理が 30 秒以内に応答しない, THEN THE Admin_Console SHALL 処理を失敗として扱い、タイムアウトを示す日本語のエラーメッセージを表示し、画面の表示内容を変更せず、確定ボタンを再度有効化する
9. THE Admin_Console SHALL すべてのボタンとタッチターゲットの高さと幅をそれぞれ 44px 以上にする