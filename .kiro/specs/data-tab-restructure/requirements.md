# Requirements Document

## Introduction

GRANアプリのナビゲーション「データ」タブ（`src/components/layout/navConfig.ts` の `id: "data"`、現状は `href: "#"`、未実装）を、次の3つのサブ画面で構成する。

- マイデータ: 自分の所属階級、GRANレベル推移、勝敗データを確認する。
- 出場データ: 通算の出場履歴を表形式で確認し、各行から詳細を確認する。
- ランキング（GRANレベル）: 階級別・種目別の順位を確認する。

本機能は既存ドキュメントの方針に沿う。

- 年間ポイント制の年間ランキングは廃止済みで、順位は `users.gran_level` に一本化されている（`docs/requirements-detail-user.md` 5.1、`docs/db-schema.md` 3.11）。
- 階級は8段階（A, AB, B, BC, C, CD, D, DE）で、レンジは `docs/requirements-detail-user.md` に定義されている。
- 画面幅は、データ・統計画面として `max-w-4xl` を使用する（`docs/ui-design-system.md`）。
- 公開プロフィールで他ユーザーに見せてよい情報は「ニックネーム」「アイコン画像」「GRANレベル」「成績」のみとする。

### 前提と未確定事項

以下は現行DBスキーマに直接のカラムが無い、または仕様が未確定の項目である。設計フェーズで確定する。

- サーフェス（コート種別）: `tournaments` にカラムが無い。追加が必要。
- 大会シリーズ: `tournaments` にカラムが無い。追加が必要。
- 季節: `tournaments.event_date` の月から導出する。月と季節の対応は用語集で定義する。
- 対戦相手別（団体戦）: `tournament_matches.entry1_id` / `entry2_id` と `entries.team_id` から導出する。
- 昇格ポイント: 階級レンジが重複している（例: A級850〜999、AB級750〜870）ため、境界の定義を設計で確定する。
- 個人対戦粒度: 団体戦の個人単位の勝敗保持は `docs/requirements-detail-administrator.md` で未決事項になっている。

## Glossary

- **Data_Tab**: ナビゲーションの「データ」タブ。マイデータ、出場データ、ランキングの3画面を束ねる。
- **My_Data_Page**: 「マイデータ」画面。
- **Participation_Page**: 「出場データ」画面。
- **Ranking_Page**: 「ランキング（GRANレベル）」画面。
- **Participation_Detail**: 出場データの1行を選択して表示する詳細表示。
- **User**: ログイン中の一般ユーザー。
- **GRAN_Level**: ユーザーの実力値レーティング（`users.gran_level`、100〜999）。
- **Tier**: 階級。A, AB, B, BC, C, CD, D, DE の8段階。
- **Tier_Range**: 各階級に対応するGRANレベルの範囲。`docs/requirements-detail-user.md` の査定基準レンジに従う。
- **Promotion_Threshold**: 現在の階級から1つ上の階級へ昇格するために必要なGRANレベルの下限値。
- **Category**: 種目。男子、女子、混合。団体戦に加え、単・複の別を持つ。
- **Season**: 季節。春（3〜5月）、夏（6〜8月）、秋（9〜11月）、冬（12〜2月）。`tournaments.event_date` の月から導出する。
- **Surface**: 試合会場のコート種別（ハード、クレー、人工芝など）。
- **Tournament_Series**: 複数の大会をまとめる大会シリーズ。
- **Win_Rate**: 勝利数 ÷ 試合数 × 100 を小数第1位まで四捨五入した値（%）。試合数が0の場合は算出不能とする。
- **Rated_Match**: GRANレベルの変動対象となった公式戦。`tournament_results` に記録される。
- **GRAN_Level_History**: `tournament_results` の `pre_gran_level`、`gran_level_diff`、`post_gran_level`、`recorded_at` から構成される変動履歴。
- **Tier_Slider**: 階級別ランキングで表示するTierを選択するスライダー。A, AB, B, BC, C, CD, D, DE の8段階の離散値を持つ。
- **Ranking_Entry**: ランキング1件分の情報（順位、ニックネーム、アイコン、GRANレベル）。

## Requirements

### Requirement 1: データタブの画面構成とナビゲーション

**User Story:** ユーザーとして、データタブから自分の成績やランキングに分かりやすく移動したい。目的の情報にすぐ辿り着くためである。

#### Acceptance Criteria

1. THE Data_Tab SHALL マイデータ、出場データ、ランキングの3つのサブ画面への切り替えタブを、この順序で左から右へ1行に並べて常時表示する。
2. WHEN User がナビゲーションの「データ」を選択する, THE Data_Tab SHALL My_Data_Page を初期表示し、マイデータのタブを選択中状態にする。
3. WHEN User がサブ画面の切り替えタブを選択する, THE Data_Tab SHALL 1秒以内に選択された画面へ遷移し、選択中のタブのみを他のタブと異なる背景色または下線で強調表示する。
4. THE Data_Tab SHALL ナビゲーション項目「データ」を実装済み（`implemented: true`）とし、My_Data_Page へ遷移する有効なリンク先を持たせる。
5. WHILE User がData_Tab配下のいずれかの画面を表示している, THE Data_Tab SHALL ナビゲーションの「データ」のみをアクティブ状態にし、他のナビゲーション項目を非アクティブ状態にする。
6. THE Data_Tab SHALL 各サブ画面のコンテンツ最大幅を `max-w-4xl`（896px）に統一する。
7. IF 未ログインのユーザーがData_Tab配下の画面へアクセスする, THEN THE Data_Tab SHALL 対象画面のコンテンツを表示せずにログイン画面へ遷移させる。
8. IF サブ画面の切り替えまたは初期表示でデータの取得に失敗する, THEN THE Data_Tab SHALL 切り替えタブとナビゲーションの表示を維持したまま、データ取得に失敗したことを示すエラー表示をコンテンツ領域に表示し、再読み込みを実行できる操作を提供する。

### Requirement 2: 所属階級と昇格ポイントの表示（マイデータ）

**User Story:** ユーザーとして、自分の所属階級と次の階級までの差を知りたい。目標を持って大会に出場するためである。

#### Acceptance Criteria

1. WHEN User がMy_Data_Pageを表示する, THE My_Data_Page SHALL User の現在のGRAN_Levelを整数値で表示する。
2. WHEN User がMy_Data_Pageを表示する, THE My_Data_Page SHALL GRAN_LevelとTier_Rangeから判定した現在のTierを1つだけ表示する。
3. WHEN User の現在のTierより上位のTierが存在し、かつ `is_level_calibrated` が `true` である, THE My_Data_Page SHALL 次のTier名と、Promotion_Thresholdから現在のGRAN_Levelを引いた差（ポイント、整数、0以上）を表示する。
4. WHEN User の現在のTierより上位のTierが存在し、かつ `is_level_calibrated` が `true` である, THE My_Data_Page SHALL 現在のTierの下限GRAN_LevelからPromotion_Thresholdまでの範囲における現在のGRAN_Levelの位置を、0〜100%の進捗バーで表示する。
5. WHERE User の現在のTierが最上位（A級）である, THE My_Data_Page SHALL 最上位階級であることを示す表示を行い、昇格までのポイント差および進捗バーを表示しない。
6. WHILE User の `is_level_calibrated` が `false` である, THE My_Data_Page SHALL GRANレベルが査定前であることを示す表示を行い、昇格ポイント差と進捗バーを表示しない。
7. IF GRAN_Levelの取得に失敗する, THEN THE My_Data_Page SHALL GRAN_Level、Tier、昇格ポイント差、進捗バーを表示せず、取得に失敗したことを示すエラーメッセージと再読み込み操作を表示する。
8. WHEN User が再読み込み操作を実行する, THE My_Data_Page SHALL GRAN_Levelの取得を再試行し、成功した場合はエラーメッセージを消して基準1〜6に従って表示を更新する。
9. IF GRAN_Levelの取得に10秒以内に応答がない, THEN THE My_Data_Page SHALL 取得失敗として基準7と同じエラー表示を行う。

### Requirement 3: GRANレベル履歴の表示（マイデータ）

**User Story:** ユーザーとして、現在と過去のGRANレベルを一覧し、推移を把握したい。自分の成長を確認するためである。

#### Acceptance Criteria

1. WHEN User がMy_Data_Pageを表示する, THE My_Data_Page SHALL GRAN_Level_Historyを確定日時の新しい順（降順）に最大20件を初期表示する。確定日時が同一の履歴が複数ある場合は、記録の登録が新しいものを先に表示する。
2. THE My_Data_Page SHALL 履歴の各行に、確定日時（YYYY/MM/DD HH:mm 形式）、大会名、変動前レベル、変動値（符号付き）、変動後レベルを表示する。
3. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL GRAN_Levelの推移を、横軸を確定日時、縦軸を変動後レベルとする時系列の折れ線グラフで表示する。
4. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL 初期表示件数や「もっと見る」の追加読み込み状況にかかわらず、取得可能な全件の履歴を確定日時の古い順にグラフへ反映する。
5. THE My_Data_Page SHALL 履歴の各行について、変動値が正の場合は「+」記号と上向きアイコン、負の場合は「−」記号と下向きアイコン、0の場合は「±0」の表記を、色に加えて表示する。
6. WHEN User がグラフ上の点を選択する, THE My_Data_Page SHALL その時点の確定日付（YYYY/MM/DD 形式）、大会名、変動後レベルを表示する。
7. WHERE GRAN_Level_Historyが0件である, THE My_Data_Page SHALL 現在のGRAN_Levelのみを表示し、履歴が存在しないことを示すメッセージを表示し、グラフと履歴一覧は表示しない。
8. WHEN 履歴の件数が20件を超える, THE My_Data_Page SHALL 「もっと見る」操作を表示し、操作ごとに次の最大20件を一覧の末尾に追加表示する。
9. IF 履歴の取得に失敗する, THEN THE My_Data_Page SHALL 履歴の取得に失敗したことを示すエラーメッセージと再読み込み操作を表示し、すでに表示済みの履歴を保持する。
10. IF 「もっと見る」操作による追加読み込みに失敗する, THEN THE My_Data_Page SHALL 追加読み込みに失敗したことを示すエラーメッセージを表示し、すでに表示済みの履歴を保持したまま「もっと見る」操作を再度実行可能にする。
11. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL グラフの横軸に、確定日付の目盛りと「YYYY/MM/DD」または「M/D」形式の目盛りラベルを、1つの形式に統一して3個以上表示する。ただし、反映する確定日付の種類が3種類未満の場合は、その種類数分の目盛りラベルを表示する。
12. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL グラフの縦軸に、GRANレベルの目盛りと整数の目盛りラベルを、等間隔で3個以上表示する。
13. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL グラフ内に縦軸の各目盛りに対応する水平の補助線を、目盛りと同数表示する。
14. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL グラフの縦軸の表示範囲の目標を、グラフに反映する変動後レベルの最小値から50を引いた値（目標下端）から、最大値に50を足した値（目標上端）までとする。
15. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL 縦軸の下端を100以上、上端を999以下とし、目標下端が100未満の場合は下端を100、目標上端が999超の場合は上端を999とする（GRAN_Levelの定義域へのクランプを、基準14の目標範囲より優先する）。
16. WHILE GRAN_Level_Historyが2件以上存在する, THE My_Data_Page SHALL 目盛りを整数のきりの良い値にそろえるため、クランプ後の範囲を、その範囲を含む最小のきりの良い値まで広げてよい。ただし、広げた後も下端は100以上、上端は999以下とし、最小値および最大値の点が軸の範囲内に収まって表示されるようにする。
17. THE My_Data_Page SHALL GRAN_Levelの推移グラフの全データを一覧にした専用のデータ表を提供しない。履歴一覧（基準1、2、8）は専用のデータ表には含まれない。

### Requirement 4: 通算勝敗と直近試合の表示（マイデータ）

**User Story:** ユーザーとして、通算の勝敗と直近の試合結果を一目で確認したい。調子や傾向を把握するためである。

#### Acceptance Criteria

1. WHEN User がMy_Data_Pageを表示する, THE My_Data_Page SHALL 通算の試合数、勝利数、敗北数、通算Win_Rateを表示する。試合数は0以上の整数、勝利数と敗北数は0以上の整数で、勝利数と敗北数の合計は試合数と一致する。通算Win_Rateは「勝利数 ÷ 試合数 × 100」を小数第1位まで四捨五入した百分率（0.0〜100.0%）で表示する。
2. WHEN User がMy_Data_Pageを表示する, THE My_Data_Page SHALL 試合日が新しい順に最大5件の直近試合の勝敗とスコア（`score_detail`）を表示する。同一試合日の試合が複数ある場合は、試合の登録日時が新しい順に並べる。
3. THE My_Data_Page SHALL 直近試合の各行に、試合日、大会名、対戦相手、勝敗、スコアを表示する。
4. THE My_Data_Page SHALL 勝敗を色と文字（「勝」「敗」）の両方で区別して表示する。勝の行と敗の行は、異なる色と異なる文字で表示される。
5. WHERE User の試合数が1以上5未満である, THE My_Data_Page SHALL 存在する試合のみを表示し、不足分の空行やプレースホルダーを表示しない。
6. WHERE User の試合数が0である, THE My_Data_Page SHALL 試合実績が無いことを示すメッセージを表示し、試合数、勝利数、敗北数を「0」、Win_Rateを「-」で表示する。
7. THE My_Data_Page SHALL 詳細な勝敗データはParticipation_Pageで確認できることを案内する文言を表示し、クリックまたはタップでParticipation_Pageへ遷移するリンクを表示する。
8. IF 通算勝敗または直近試合の取得に失敗する, THEN THE My_Data_Page SHALL 取得に失敗したことを示すエラーメッセージを表示し、取得できなかった項目の数値を表示せず、再読み込み操作を提供する。
9. IF 直近試合の行に対応する `score_detail` が未登録である, THEN THE My_Data_Page SHALL スコア欄を「-」で表示し、その他の項目は通常どおり表示する。

### Requirement 5: 条件別の勝率の表示（マイデータ）

**User Story:** ユーザーとして、種目、会場、サーフェスなどの条件別に勝率を確認したい。自分の得意・不得意を把握するためである。

#### Acceptance Criteria

1. THE My_Data_Page SHALL 条件別Win_Rateの条件として、種目、会場、サーフェス、季節、対戦相手（団体戦）、大会シリーズの6つを、プルダウン（セレクトボックス）の選択肢として提供する。
2. WHEN User がプルダウンから条件を選択する, THE My_Data_Page SHALL 選択された条件の値ごとに、試合数、勝利数、敗北数、Win_Rateを一覧表示する。
3. WHEN 条件として種目が選択される, THE My_Data_Page SHALL 男子、女子、混合の3区分のみでWin_Rateを表示し、「未設定」区分を表示しない。
4. WHEN 条件として季節が選択される, THE My_Data_Page SHALL 試合開催日の月に基づき、春（3〜5月）、夏（6〜8月）、秋（9〜11月）、冬（12〜2月）の4区分でWin_Rateを表示する。
5. WHEN 条件として対戦相手（団体戦）が選択される, THE My_Data_Page SHALL 団体戦の対戦チームごとにWin_Rateを表示し、個人戦の試合は集計対象から除外する。
6. THE My_Data_Page SHALL 各区分のWin_Rateを、小数点以下を四捨五入した0〜100%の整数値の数値表示と、その値に比例した長さの横棒グラフ（0%の長さを0、100%の長さを横棒グラフ表示領域の全幅とする）の両方で表示する。
7. IF 選択した条件の値で試合数が0である, THEN THE My_Data_Page SHALL その値のWin_Rateを「-」で表示し、横棒グラフの長さを0とする。
8. IF 試合のサーフェスまたは大会シリーズが未登録である, THEN THE My_Data_Page SHALL その試合を「未設定」区分に集計する。種目は常に男子、女子、混合のいずれかであるため、「未設定」区分は、サーフェスと大会シリーズの条件に限って表示する。
9. THE My_Data_Page SHALL 条件別Win_Rateの集計対象を、結果が確定（`match_status` が `FINISHED`）した試合に限定する。
10. WHEN 条件別Win_Rateの集計対象となる試合が全条件を通じて0件である, THE My_Data_Page SHALL 全区分のWin_Rateを「-」で表示し、集計対象の試合がないことを示すメッセージを表示する。
11. IF 条件別Win_Rateのデータ取得に失敗する, THEN THE My_Data_Page SHALL 取得に失敗したことを示すエラーメッセージと再読み込み操作を表示し、直前に表示していた集計結果を保持する。
12. WHEN User がプルダウンで選択する条件を変更する, THE My_Data_Page SHALL 変更前の条件の集計結果を、変更後の条件の集計結果の表示に置き換える。
13. WHEN User が再読み込み操作を実行する, THE My_Data_Page SHALL 現在選択中の条件でデータを再取得し、取得に成功した場合はエラーメッセージを消去して最新の集計結果を表示する。

### Requirement 6: 出場履歴の一覧表示（出場データ）

**User Story:** ユーザーとして、これまでの出場履歴を表形式で確認したい。過去の大会成績を振り返るためである。

#### Acceptance Criteria

1. WHEN User がParticipation_Pageを表示する, THE Participation_Page SHALL User の通算出場履歴を、開催日の降順（新しい順）を初期の並び順として表形式で表示する。
2. THE Participation_Page SHALL 表の各行に、開催年月日、会場、種目、階級、結果（成績区分）を表示する。
3. WHEN 出場履歴の件数が20件を超える, THE Participation_Page SHALL 1回の表示を最大20件とし、ページ送りまたは「もっと見る」操作により次の最大20件を表示する。
4. WHEN User が種目、階級、年のいずれか1つ以上で絞り込みを指定する, THE Participation_Page SHALL 指定された全条件に一致する出場履歴のみを表示し、表示を1ページ目（先頭20件）に戻す。
5. WHEN User が開催日の並び順を切り替える, THE Participation_Page SHALL 全出場履歴（絞り込み適用後）を開催日の昇順または降順で並べ替え、表示を1ページ目（先頭20件）に戻す。
6. WHILE 画面幅がモバイル幅（md未満）である, THE Participation_Page SHALL 横スクロール無しで、開催年月日、会場、結果を各行に表示する。
7. IF 出場履歴が1件も存在しない, THEN THE Participation_Page SHALL 出場履歴が無いことを示すメッセージと大会日程画面へのリンクを表示する。
8. IF 絞り込み条件に一致する出場履歴が0件である, THEN THE Participation_Page SHALL 条件に一致する履歴が無いことを示すメッセージと絞り込み条件を解除する操作を表示する。
9. THE Participation_Page SHALL キャンセル済みのエントリーを出場履歴の表示、件数、絞り込み結果から除外する。
10. IF 出場履歴の取得に失敗する, THEN THE Participation_Page SHALL 取得失敗を示すエラーメッセージと再読み込み操作を表示し、表の内容を空表示にしない。

### Requirement 7: 出場詳細の確認（出場データ）

**User Story:** ユーザーとして、出場履歴の各行から詳細を確認したい。試合ごとの内容を振り返るためである。

#### Acceptance Criteria

1. WHEN User が出場履歴の行をクリック、タップ、または Enter キーもしくは Space キーで選択する, THE Participation_Page SHALL 選択操作から1秒以内に、選択された大会の Participation_Detail を表示する。
2. THE Participation_Detail SHALL 大会名、開催年月日（YYYY/MM/DD 形式）、会場、種目、階級、結果（成績区分）を表示する。
3. THE Participation_Detail SHALL 当該大会での各試合について、ラウンド、対戦相手、スコア、勝敗（勝ち・負け・引き分けのいずれか）を、ラウンドの昇順で表示する。
4. THE Participation_Detail SHALL 当該大会での GRAN レベルの変動前の値、変動値（増加は「+」、減少は「-」の符号付き）、変動後の値を表示する。
5. WHEN User が Participation_Detail を閉じる操作（閉じるボタン、Esc キー、またはブラウザの戻る操作）を行う, THE Participation_Page SHALL 一覧表示に戻り、選択前のスクロール位置と絞り込み条件を維持し、閉じた行にフォーカスを戻す。
6. THE Participation_Page SHALL 出場履歴の各行を Tab キーによるフォーカス移動と Enter キーまたは Space キーによる選択が可能な状態にし、各行のタップ領域の最小高さを 44px とする。
7. IF Participation_Detail のデータ取得に失敗する, THEN THE Participation_Page SHALL 取得失敗を示すエラーメッセージと再試行操作を表示し、一覧表示の状態（スクロール位置と絞り込み条件）を保持する。
8. WHEN User が再試行操作を行う, THE Participation_Page SHALL Participation_Detail のデータ取得を再実行し、成功した場合はエラーメッセージを消して Participation_Detail を表示する。
9. WHERE 当該大会の試合結果が未確定である, THE Participation_Detail SHALL 結果が未確定であることを示す表示を行い、未確定の項目（結果、スコア、勝敗、GRAN レベルの変動値）には確定済みの値と区別できる未確定表示を行う。

### Requirement 8: 階級別ランキング（ランキング）

**User Story:** ユーザーとして、階級ごとのGRANレベル順位を見たい。同じ階級の中での自分の位置を知るためである。

#### Acceptance Criteria

1. WHEN User がRanking_Pageの階級別を開く, THE Ranking_Page SHALL 8つのTier（A, AB, B, BC, C, CD, D, DE）をこの順序で選択できるTier_Slider（A〜DEの8段階の離散値を持つスライダー）を1つ表示し、選択中のTier名をTier_Sliderの近傍に表示する。8つのTierを並べたタブは表示しない。
2. WHEN Ranking_Pageが初回表示される, THE Ranking_Page SHALL Tier_Sliderの選択位置を User の現在のTierにし、そのTierの順位表を表示する。
3. WHEN User がTier_Sliderの選択位置を変更する, THE Ranking_Page SHALL 選択前の表示を、該当TierのRanking_EntryをGRAN_Levelの降順で並べた順位表に置き換え、選択中のTier名の表示を更新する。この表示の置き換えは、順位表の取得完了から1秒以内に完了する。
4. THE Ranking_Page SHALL 各Ranking_Entryに、順位（1以上の整数）、アイコン、ニックネーム、GRAN_Levelを表示する。
5. WHEN 複数のユーザーのGRAN_Levelが同値である, THE Ranking_Page SHALL 公式戦消化試合数（`rated_match_count`）が多いユーザーを上位とし、`rated_match_count` も同数の場合は直近の勝率が高いユーザーを上位とする。
6. WHILE User が選択中のTierに属している, THE Ranking_Page SHALL 選択中のTierの順位表で User の行を他の行と視覚的に区別できるよう強調表示し、「階級内順位 / 階級内総人数」（例: 「3位 / 42人」）を表示する。階級内総人数には `is_level_calibrated` が `false` のユーザーを含めない。
7. IF 選択したTierに表示対象のユーザーが0人である, THEN THE Ranking_Page SHALL 順位表の代わりに、該当者が居ないことを示すメッセージを表示し、Tier_Sliderは操作可能な状態を維持する。
8. THE Ranking_Page SHALL 氏名（`real_name`）、電話番号、メールアドレスを表示しない。
9. THE Ranking_Page SHALL `is_level_calibrated` が `false` のユーザーを順位表と順位計算から除外する。
10. WHEN 選択中のTierの順位表の件数が50件を超える, THE Ranking_Page SHALL 初期表示を上位50件とし、続きを50件単位で「もっと見る」操作またはページ送りにより表示する。
11. IF 順位表の取得に失敗する, THEN THE Ranking_Page SHALL 取得に失敗したことを示すエラーメッセージと再読み込み操作を表示し、直前に表示していた選択TierのTier_Slider選択位置を保持する。
12. WHILE Tier_Sliderにフォーカスがある, THE Ranking_Page SHALL 左矢印キーまたは下矢印キーで1段階下位のTier、右矢印キーまたは上矢印キーで1段階上位のTierへ選択位置を移動し、DE（下端）とA（上端）を超える移動を行わない。
13. WHEN User がTier_Sliderのつまみをドラッグまたはタップして操作する, THE Ranking_Page SHALL 8段階の離散位置のうち最も近い位置にのみ選択位置を確定し、8段階の間の中間位置では停止しない。
14. IF User の現在のTierを判定できない, THEN THE Ranking_Page SHALL 初回表示時のTier_Sliderの選択位置をA（上端）にし、Aの順位表を表示する。

### Requirement 9: 種目別ランキング（ランキング）

**User Story:** ユーザーとして、種目ごとのGRANレベル順位を見たい。種目ごとの自分の位置を知るためである。

#### Acceptance Criteria

1. WHEN User がRanking_Pageの種目別を選択する, THE Ranking_Page SHALL 種目（男子、女子、混合）の切り替えタブを3つ表示し、初期状態で「男子」タブを選択状態にする。
2. WHEN User が種目を選択する, THE Ranking_Page SHALL 該当種目のRanking_EntryをGRAN_Levelの降順で表示し、GRAN_Levelが同値の場合は同一順位（例: 1位、2位、2位、4位）として表示する。
3. THE Ranking_Page SHALL 種目別の各Ranking_Entryに、順位、アイコン、ニックネーム、GRAN_Level、所属階級を表示する。
4. WHILE User が選択中の種目の順位表に含まれている, THE Ranking_Page SHALL 順位表で User の行を強調表示し、種目内順位と種目内総人数を「N位 / M人」の形式で表示する。
5. THE Ranking_Page SHALL 階級別と種目別の表示切り替え操作を、画面上部の1か所に配置する。
6. WHEN User が階級別と種目別を切り替える, THE Ranking_Page SHALL 切り替え前に選択していたTierまたは種目の選択状態を、同一セッション中に再度切り替えて戻った時点で復元する。
7. THE Ranking_Page SHALL 同一ユーザーに対する階級別順位と種目別順位が同じGRAN_Levelの値に基づくことを保証する。
8. WHERE 種目別ランキングの集計単位（性別による区分か、種目別レーティングか）が確定していない, THE Ranking_Page SHALL 設計フェーズで確定した集計単位に従って表示する。
9. IF 選択された種目に該当するRanking_Entryが0件である, THEN THE Ranking_Page SHALL 順位表の代わりに該当ユーザーがいないことを示す空状態メッセージを表示し、種目切り替えタブを操作可能な状態に保つ。
10. IF 種目別ランキングデータの取得が10秒以内に完了しない、または取得に失敗する, THEN THE Ranking_Page SHALL 取得失敗を示すエラーメッセージと再読み込み操作を表示し、直前に表示していた順位表を保持する。

### Requirement 10: 表示状態とアクセシビリティ

**User Story:** ユーザーとして、読み込み中や失敗時の状態が分かり、どの端末でも読みやすい画面を使いたい。安心してデータを確認するためである。

#### Acceptance Criteria

1. WHEN データの取得を開始する, THE Data_Tab SHALL 取得開始から200ミリ秒以内に、各データ表示領域の位置にスケルトンまたはローディング表示を行い、取得完了または失敗した時点で当該表示を除去する。
2. IF データ取得が失敗する（通信エラー、または取得開始から10秒以内に応答がない場合）, THEN THE Data_Tab SHALL 失敗した領域に、取得に失敗したことを示すメッセージと再試行操作を表示し、既に表示済みの他領域のデータは保持する。
3. WHEN ユーザーが再試行操作を実行する, THE Data_Tab SHALL 失敗した領域のみを再取得し、再取得中は当該領域にローディング表示を行う。
4. IF 同一領域で再試行が連続して3回失敗する, THEN THE Data_Tab SHALL 再試行操作の表示を維持したまま、時間をおいて再度お試しいただく旨のメッセージを表示する。
5. THE Data_Tab SHALL 本文テキストを14px以上、注釈テキストを12px以上で、画面幅320px以上のすべての表示環境で表示する。
6. THE Data_Tab SHALL 勝敗や増減を色のみで伝えず、文字・記号・アイコンのいずれかを併用する。
7. THE Data_Tab SHALL グラフ専用のデータ表を設けず、グラフの値を、軸の目盛りラベル、グラフ上の点を選択したときの表示、および同一画面内のGRAN_Level_History一覧で確認できるようにする。
8. THE Data_Tab SHALL `docs/ui-design-system.md` のカラートークン、角丸、タイポグラフィ規定に従う。
9. WHILE ダークモードが有効である, THE Data_Tab SHALL ダークモード用のカラートークンで表示し、本文テキストと背景のコントラスト比、および注釈テキストと背景のコントラスト比をいずれも4.5:1以上に保つ。

### Requirement 11: プライバシーとアクセス制御

**User Story:** ユーザーとして、自分の成績が適切に保護され、他人には公開範囲の情報だけが見えてほしい。安心して利用するためである。

#### Acceptance Criteria

1. WHEN User が My_Data_Page または Participation_Page を表示する, THE Data_Tab SHALL ログイン中のUser自身のデータのみを表示し、他のUserのデータを1件も含めない。
2. IF ログイン中のUserが、自分以外のUserのマイデータまたは出場データの取得を要求する, THEN THE Data_Tab SHALL 取得を拒否し、アクセス権限が無いことを示すエラーを返し、対象Userのデータを一切返さない。
3. IF 未ログイン状態で My_Data_Page または Participation_Page のデータ取得が要求される, THEN THE Data_Tab SHALL 取得を拒否し、認証が必要であることを示すエラーを返し、データを一切返さない。
4. WHEN Ranking_Page が他Userの情報を表示する, THE Ranking_Page SHALL 各他Userについて、ニックネーム、アイコン画像、GRAN_Level、所属階級の4項目のみを表示し、それ以外の項目（氏名、メールアドレス、成績詳細を含む）を表示しない。
5. WHEN Participation_Detail が対戦相手を表示する, THE Participation_Detail SHALL 対戦相手を、ニックネームで表示する。
6. WHERE 対戦相手がゲスト（`member_type` が `GUEST`）である, THE Participation_Detail SHALL 対戦相手の表示をゲスト氏名ではなく固定文言「ゲスト」とする。