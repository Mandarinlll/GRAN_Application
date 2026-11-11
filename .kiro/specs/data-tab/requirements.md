# Requirements Document

## Introduction

本仕様は、テニス大会運営アプリ「GRAN」における未実装の「データ」タブ（ボトムナビゲーション／サイドバーの `data` 項目）の機能要件を定義する。データタブは、ユーザー向けの統計・ランキング・履歴のハブ画面群であり、既存仕様の「規定レベル内順位」機能（`requirements-summary.md` / `requirements-detail-user.md` 5.1）を発展させたものである。

データタブは閲覧専用機能であり、GRANレベルの変動・結果入力・レート計算は管理者側スコープ（本仕様の対象外）が担う。本機能は以下の5つの画面領域で構成される。

1. 個人ランキング（GRANレベル基準：全体／規定階級内）
2. チームランキング（GRANレベルに基づくチーム指標）
3. レベル推移（自身のGRANレベル時系列）
4. 出場履歴（自身の過去の大会出場一覧）
5. レベル分布（全体／階級別のGRANレベル分布）

本機能は大会結果・レート変動履歴（`tournament_results` テーブル）に強く依存するが、同テーブルは現時点で未実装（定義のみ）である。したがって本仕様は「履歴データの提供元である `tournament_results` が整備されていること」を前提としつつ、未整備時のフォールバック（履歴ゼロ時の空状態表示）を明示する。

公開プロフィールの情報公開ルール（本名・個人エントリー者名は非公開、ニックネーム／アイコン／GRANレベル3桁／成績のみ公開）を順守する。モバイルWeb（SPA）を主画面とし、md以上ではヘッダー／サイドバーナビを提供する。タッチターゲットは44px以上、重要情報はHTMLテキスト化し音声読み上げに配慮する。

### 要検討事項（オープンな論点）

以下は本仕様では確定せず、設計フェーズで決定すべきオープンな論点として明記する。各該当要件にも参照を付す。

- **論点A（チームレート算出式）**: チームの「GRANレベル指標」の算出方法（メンバー平均レート／上位N名平均／加重平均など）。対象メンバー範囲（全 `team_members` か、直近の出場メンバーか）も未確定。
- **論点B（同率時の詳細順序ルール）**: GRANレベルが同率の場合の順序決定基準（公式戦消化試合数 `rated_match_count`、直近勝率、最終対戦日時など）の優先順位と「直近」の定義（直近何試合か）。
- **論点C（未査定ユーザーの扱い）**: `is_level_calibrated = false` のユーザーをランキング・分布に含めるか、別枠（暫定）として区別表示するか。
- **論点D（勝率の算出元）**: 「勝率」の計算に用いるデータソース。`tournament_matches`（試合単位の勝敗）が未実装のため、算出可否と暫定定義が未確定。
- **論点E（期間フィルタの粒度）**: レベル推移・出場履歴の期間フィルタの選択肢（全期間／年／直近Nヶ月など）。
- **論点F（レスポンシブ・ブレークポイント値）**: データタブのレスポンシブ切替の境界値（暫定768px）の確定。既存の navConfig / AppShell のブレークポイントと整合させる。

## Glossary

- **GRAN_Data_Tab**: データタブ機能全体を指すシステム。ユーザー向けの統計・ランキング・履歴のハブ画面群。
- **Personal_Ranking_View**: 個人のGRANレベルに基づく順位を表示する画面領域。
- **Team_Ranking_View**: チームのGRANレベル指標に基づく順位を表示する画面領域。
- **Level_History_View**: ログインユーザー自身のGRANレベルの時系列推移を表示する画面領域。
- **Entry_History_View**: ログインユーザー自身の過去の大会出場一覧を表示する画面領域。
- **Level_Distribution_View**: GRANレベルの分布（ヒストグラム）を表示する画面領域。
- **GRANレベル (GRAN_Level)**: 個人のイロレーティング実力値。整数100〜999（`users.gran_level`、SMALLINT、CHECK 100〜999）。
- **規定階級 (Tier)**: GRANレベルの連続境界で判定される8段階の階級。A(850〜999) / AB(750〜849) / B(650〜749) / BC(550〜649) / C(450〜549) / CD(350〜449) / D(250〜349) / DE(100〜249)。判定ロジックは `src/features/auth/utils/classLabel.ts`（`granLevelToTier`）に準拠。
- **is_level_calibrated**: 管理者による初期レベル査定完了フラグ（BOOLEAN、初期値 false）。
- **rated_match_count**: 公式戦消化試合数（SMALLINT、初期値 0）。
- **tournament_results**: 大会結果・GRANレベル変動記録テーブル（`pre_gran_level` / `gran_level_diff` / `post_gran_level` / `rank_type` / `recorded_at` 等）。現時点で未実装（定義のみ）。レベル推移・出場履歴の提供元。
- **成績区分 (rank_type)**: 大会での成績区分（`result_rank_enum`: PARTICIPATED / L2_WINNER / T1_RUNNER_UP / T1_WINNER）。
- **種目区分 (category)**: 大会の種目・部門（`tournament_category_enum`: MEN_TEAM / WOMEN_TEAM / MIX_TEAM / SINGLES / DOUBLES）。
- **公開プロフィール情報 (Public_Profile_Fields)**: 他ユーザーから閲覧可能な項目。ニックネーム、アイコン画像、GRANレベル（3桁数値）、成績に限定される。本名・個人エントリー者名は非公開。
- **空状態表示 (Empty_State)**: 対象データが0件の場合に表示する、データ不在を伝える専用の画面状態。
- **閲覧ユーザー (Viewing_User)**: データタブを閲覧しているログイン中のユーザー。

## Requirements

### Requirement 1: データタブへのアクセスと画面構成

**User Story:** As a 閲覧ユーザー, I want データタブから統計・ランキング・履歴の各画面へ移動する, so that 自身の実力や立ち位置をひとつの導線で把握できる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーがナビゲーションの「データ」項目を選択する, THE GRAN_Data_Tab SHALL 操作から3秒以内にデータタブのトップ画面を表示する
2. THE GRAN_Data_Tab SHALL 個人ランキング、チームランキング、レベル推移、出場履歴、レベル分布の5つの画面領域への導線を提供する
3. WHILE 画面幅が論点Fで定める境界値（暫定768px）未満である, THE GRAN_Data_Tab SHALL ボトムナビゲーションおよび画面内タブによって各画面領域を切り替える表示を提供する（要検討事項：論点F）
4. WHILE 画面幅が論点Fで定める境界値（暫定768px）以上である, THE GRAN_Data_Tab SHALL 共通ヘッダーまたはサイドバーによるナビゲーションを表示する（要検討事項：論点F）
5. THE GRAN_Data_Tab SHALL すべての操作可能なタッチターゲットを幅44px以上かつ高さ44px以上の最小サイズで表示する
6. IF 未認証のリクエストがデータタブに到達する, THEN THE GRAN_Data_Tab SHALL ログイン画面へリダイレクトする
7. THE GRAN_Data_Tab SHALL 順位・レベル・成績などの重要情報を画像ではなくHTMLテキストとして表示する

### Requirement 2: 個人ランキング（全体）

**User Story:** As a 閲覧ユーザー, I want 全ユーザーのGRANレベルに基づく全体順位を確認する, so that 自身の全体での立ち位置を把握できる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーが個人ランキングの全体表示を開く, THE Personal_Ranking_View SHALL ランキング対象の全ユーザーをGRANレベル（整数100〜999）の降順で並べた一覧を表示する
2. THE Personal_Ranking_View SHALL 一覧の各ユーザーについて、公開プロフィール情報であるニックネーム、アイコン画像、GRANレベル（3桁数値）、および全体順位のみを表示する
3. THE Personal_Ranking_View SHALL 本名および個人エントリー者の本名を表示しない
4. WHEN 全体順位の一覧を表示する, THE Personal_Ranking_View SHALL 閲覧ユーザー自身の行を、視覚的な強調に加えて音声読み上げで識別可能なテキストを付与して他ユーザーの行と区別して表示する
5. WHEN 全体順位の一覧を表示する, THE Personal_Ranking_View SHALL 閲覧ユーザー自身の全体順位、ランキング対象の総人数、および自身のGRANレベルを表示する
6. IF 閲覧ユーザー自身がランキング対象に含まれない, THEN THE Personal_Ranking_View SHALL 自身の全体順位を「対象外」である旨のテキストで表示し、ランキング対象の総人数と自身のGRANレベルは引き続き表示する
7. IF ランキング対象ユーザーが0名である, THEN THE Personal_Ranking_View SHALL 空状態表示を行う
8. IF あるユーザーのアイコン画像が未設定または取得できない, THEN THE Personal_Ranking_View SHALL 当該ユーザーの行に既定の代替アイコンを表示し、当該行の他項目（ニックネーム、GRANレベル、全体順位）は引き続き表示する
9. IF 2名以上のユーザーのGRANレベルが同一である, THEN THE Personal_Ranking_View SHALL 論点Bで定める同率時順序ルールに従って順序を決定する（要検討事項：論点B）
10. WHERE is_level_calibrated が false のユーザーが存在する, THE Personal_Ranking_View SHALL 論点Cで定める扱いに従って当該ユーザーを表示または区別表示する（要検討事項：論点C）

### Requirement 3: 個人ランキング（規定階級内）

**User Story:** As a 閲覧ユーザー, I want 規定階級ごとの階級内順位を確認する, so that 自身が属する階級での相対的な実力を把握できる

#### Acceptance Criteria

1. THE Personal_Ranking_View SHALL 8段階の規定階級（A / AB / B / BC / C / CD / D / DE）をタブまたはフィルターで切り替える操作を提供する
2. WHEN 閲覧ユーザーが特定の規定階級を選択する, THE Personal_Ranking_View SHALL 当該階級に属するユーザーのみをGRANレベルの降順で並べ、各ユーザーに階級内順位を付与して表示する
3. THE Personal_Ranking_View SHALL 各ユーザーの規定階級を granLevelToTier の連続区間（A:850〜999 / AB:750〜849 / B:650〜749 / BC:550〜649 / C:450〜549 / CD:350〜449 / D:250〜349 / DE:100〜249）に従って判定する
4. WHEN 閲覧ユーザーが自身の属する規定階級を表示する, THE Personal_Ranking_View SHALL 自身の行を視覚的な強調に加えて音声読み上げで識別可能なテキストを付与して区別し、自身の階級内順位、当該階級内の総人数、自身のGRANレベルを表示する
5. IF 選択された規定階級に属するユーザーが0名である, THEN THE Personal_Ranking_View SHALL データが存在しない旨を説明するテキストを含む空状態表示を行う
6. IF 同一階級内で2名以上のGRANレベルが同一である, THEN THE Personal_Ranking_View SHALL 論点Bで定める同率時順序ルールに従って順序を決定する（要検討事項：論点B）
7. WHERE is_level_calibrated が false のユーザーが存在する, THE Personal_Ranking_View SHALL 論点Cで定める扱いに従って当該ユーザーを表示または区別表示する（要検討事項：論点C）

### Requirement 4: チームランキング

**User Story:** As a 閲覧ユーザー, I want チームのGRANレベル指標に基づくランキングを確認する, so that チーム同士の実力を比較できる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーがチームランキングを開く, THE Team_Ranking_View SHALL ランキング対象チームをチームGRANレベル指標の降順で並べた一覧を表示する
2. THE Team_Ranking_View SHALL 各チームについてチーム名、チームアイコン、代表者ニックネーム、チームGRANレベル指標、チーム順位を表示する
3. IF チームにチームアイコンが設定されていない, THEN THE Team_Ranking_View SHALL 当該チームに既定のプレースホルダーアイコンを表示する
4. THE Team_Ranking_View SHALL チームGRANレベル指標を論点Aで定める算出式に従って算出する（要検討事項：論点A）
5. WHERE チームに所属メンバーが1名以上存在する, THE Team_Ranking_View SHALL 当該チームをランキング対象に含める
6. IF チームに有効なGRANレベルを持つ対象メンバーが0名である, THEN THE Team_Ranking_View SHALL 当該チームをランキング対象から除外する
7. IF 2つ以上のチームのチームGRANレベル指標が等しい, THEN THE Team_Ranking_View SHALL 当該チームを代表者ニックネームの昇順で並べ、かつ同一指標のチームに同一のチーム順位を付与する
8. IF 登録チームが0件である, THEN THE Team_Ranking_View SHALL 対象チームが存在しない旨を示す空状態表示を行う
9. IF ランキング対象チームが0件である, THEN THE Team_Ranking_View SHALL 対象チームが存在しない旨を示す空状態表示を行う
10. WHERE 種目・部門での区別表示が有効である, THE Team_Ranking_View SHALL 論点Aで定める種目・部門の扱いに従って表示を切り替える（要検討事項：論点A）

### Requirement 5: レベル推移

**User Story:** As a 閲覧ユーザー, I want 自身のGRANレベルの時系列推移を確認する, so that 自身の成長や変動を振り返ることができる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーがレベル推移を開く, THE Level_History_View SHALL 操作から3秒以内に閲覧ユーザー自身のGRANレベル変動を時系列グラフとして表示する
2. THE Level_History_View SHALL 各変動点について tournament_results の pre_gran_level、gran_level_diff、post_gran_level、recorded_at を表示する
3. THE Level_History_View SHALL 時系列グラフの各変動点を recorded_at の昇順で配置する
4. WHILE 期間フィルタが未選択である, THE Level_History_View SHALL 閲覧ユーザー自身の全期間の変動点を recorded_at の昇順で表示する
5. WHEN 閲覧ユーザーが期間フィルタを選択する, THE Level_History_View SHALL 選択された期間内の変動点のみを表示する（期間の選択肢は要検討事項：論点E）
6. IF 閲覧ユーザーの tournament_results が0件である, THEN THE Level_History_View SHALL グラフ領域を表示せず、履歴が未記録である旨を説明するテキストを含む空状態表示を行う
7. IF 選択された期間内に該当する変動点が0件である, THEN THE Level_History_View SHALL 当該期間に変動が無い旨を説明するテキストを表示する
8. IF レベル推移データの取得に失敗する, THEN THE Level_History_View SHALL グラフおよび数値情報を表示せず、取得に失敗した旨を示すエラー表示を提示し、再取得を可能とする
9. THE Level_History_View SHALL グラフ表示に加えて、各変動点の pre_gran_level、gran_level_diff、post_gran_level、recorded_at を音声読み上げ可能なテキストまたは表形式で提供する

### Requirement 6: 出場履歴

**User Story:** As a 閲覧ユーザー, I want 自身の過去の大会出場一覧を確認する, so that これまでの戦績と大会参加の履歴を振り返ることができる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーが出場履歴を開く, THE Entry_History_View SHALL 操作から3秒以内に閲覧ユーザー自身が出場した過去の大会の一覧を表示する
2. THE Entry_History_View SHALL 各出場について大会名、開催日、種目区分、階級、成績区分、GRANレベル変動値（gran_level_diff）を表示する
3. IF ある出場の gran_level_diff が未記録である, THEN THE Entry_History_View SHALL 当該項目に未記録である旨を示すプレースホルダーを表示し、当該行の他項目は引き続き表示する
4. THE Entry_History_View SHALL 出場履歴の初期表示を開催日の降順で並べる
5. WHEN 閲覧ユーザーがソート基準とソート方向（昇順／降順）を変更する, THE Entry_History_View SHALL 選択された基準（開催日、種目区分、成績区分のいずれか）と方向で一覧を並べ替え、ソートキーが等しい行は開催日の降順で安定的に並べる
6. WHEN 閲覧ユーザーが種目区分または階級でフィルターを指定する, THE Entry_History_View SHALL 指定条件に一致する出場のみを表示する
7. IF 指定されたフィルター条件に一致する出場が0件である, THEN THE Entry_History_View SHALL 条件に一致する履歴が無い旨を説明するテキストを表示する
8. IF 閲覧ユーザーの出場履歴が0件である, THEN THE Entry_History_View SHALL 履歴が未記録である旨を説明するテキストを含む空状態表示を行う
9. IF 出場履歴データの取得に失敗する, THEN THE Entry_History_View SHALL 一覧を表示せず、取得に失敗した旨を示すエラー表示を提示し、再取得を可能とする

### Requirement 7: レベル分布

**User Story:** As a 閲覧ユーザー, I want 全体および階級別のGRANレベル分布を確認する, so that 母集団の中での自身の位置を視覚的に把握できる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーがレベル分布を開く, THE Level_Distribution_View SHALL 有効なGRANレベル（100〜999）を持つ全ユーザーをGRANレベルの昇順に区切ったヒストグラムとして表示する
2. THE Level_Distribution_View SHALL ヒストグラムの各区間を8段階の規定階級の境界（A:850〜999 / AB:750〜849 / B:650〜749 / BC:550〜649 / C:450〜549 / CD:350〜449 / D:250〜349 / DE:100〜249）に一致させ、各区間に属するユーザー数を表示する
3. WHEN 閲覧ユーザーが全体表示と規定階級別表示を切り替える, THE Level_Distribution_View SHALL 選択された表示単位に応じた分布を表示する
4. THE Level_Distribution_View SHALL ヒストグラム上に閲覧ユーザー自身のGRANレベルが属する区間の位置を示すインジケータを表示する
5. IF 閲覧ユーザー自身の GRANレベルが未確定である、または is_level_calibrated が false である, THEN THE Level_Distribution_View SHALL 自身の位置インジケータを表示せず、位置が確定していない旨を説明するテキストを表示する
6. THE Level_Distribution_View SHALL 各規定階級の区間（GRANレベルの下限値と上限値）とその人数を音声読み上げ可能なHTMLテキストまたは表形式で提供する
7. IF 有効なGRANレベルを持つ対象ユーザーが0名である, THEN THE Level_Distribution_View SHALL 空状態表示を行う
8. WHERE is_level_calibrated が false のユーザーが存在する, THE Level_Distribution_View SHALL 論点Cで定める扱いに従って当該ユーザーを分布に含めるか区別表示する（要検討事項：論点C）

### Requirement 8: 他ユーザー・他チームの公開プロフィール内データ閲覧

**User Story:** As a 閲覧ユーザー, I want ランキングから他ユーザーや他チームの公開データを閲覧する, so that 対戦相手や他チームの実力を確認できる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーがランキング一覧の他ユーザーの行を選択する, THE GRAN_Data_Tab SHALL 当該ユーザーの公開プロフィール情報（ニックネーム、アイコン画像、GRANレベル3桁数値、成績）を表示する
2. THE GRAN_Data_Tab SHALL 他ユーザーの本名、フリガナ、電話番号、メールアドレス、生年月日を表示しない
3. WHEN 閲覧ユーザーがチームランキング一覧のチームを選択する, THE GRAN_Data_Tab SHALL 当該チームの公開情報（チーム名、チームアイコン、代表者ニックネーム、メンバーのニックネーム、獲得ポイント）を表示する
4. THE GRAN_Data_Tab SHALL チームメンバーをニックネームで表示し、本名を表示しない

### Requirement 9: 成績サマリ指標

**User Story:** As a 閲覧ユーザー, I want 自身の成績サマリ指標を確認する, so that 出場回数や優勝回数などの実績を一目で把握できる

#### Acceptance Criteria

1. WHEN 閲覧ユーザーが成績サマリを開く, THE GRAN_Data_Tab SHALL 閲覧ユーザー自身の総出場回数、優勝回数（rank_type が T1_WINNER の件数）、準優勝回数（rank_type が T1_RUNNER_UP の件数）を、開く操作から3秒以内に表示する
2. THE GRAN_Data_Tab SHALL 総出場回数を閲覧ユーザー自身に紐づく tournament_results のレコード件数のみとして算出し、他ユーザーのレコードを集計に含めない
3. WHERE 勝率の算出に必要な全データ項目（出場件数および勝利件数）が取得可能である, THE GRAN_Data_Tab SHALL 論点Dで定める定義に従って勝率を表示する（要検討事項：論点D）
4. IF 閲覧ユーザーの tournament_results が0件である, THEN THE GRAN_Data_Tab SHALL 各成績サマリ指標を0として表示する
5. IF 成績サマリ指標の算出元データの取得に失敗する, THEN THE GRAN_Data_Tab SHALL 指標値を表示せず、取得に失敗した旨を示すエラー表示を提示し、再取得を可能とする

### Requirement 10: 履歴データ未整備時のフォールバック

**User Story:** As a 閲覧ユーザー, I want 履歴データが未整備な状態でもデータタブを支障なく閲覧する, so that エラーに遭遇せず利用できる

#### Acceptance Criteria

1. THE GRAN_Data_Tab SHALL tournament_results が整備されていることを前提に、レベル推移・出場履歴・成績サマリを表示する
2. IF tournament_results に由来するデータが取得できない, THEN THE GRAN_Data_Tab SHALL エラー画面ではなく空状態表示を行う
3. WHEN 空状態表示を行う, THE GRAN_Data_Tab SHALL データが未記録である旨を説明するテキストを表示する
4. THE GRAN_Data_Tab SHALL tournament_results に依存しない機能（個人ランキング、レベル分布）を users.gran_level のみから算出して表示する

### Requirement 11: 閲覧専用動作

**User Story:** As a 閲覧ユーザー, I want データタブが閲覧専用であることを前提に利用する, so that 誤ってデータを変更する操作を避けられる

#### Acceptance Criteria

1. THE GRAN_Data_Tab SHALL GRANレベル、順位、成績、履歴の更新・編集・削除操作を提供しない
2. WHEN 閲覧ユーザーがデータタブ内の任意の画面を操作する, THE GRAN_Data_Tab SHALL users、teams、tournament_results の各データを変更しない
