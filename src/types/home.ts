// このファイルは「データの形（型）」だけを定義する場所。
// 実物のデータ（値）は src/data/homeData.ts に置く。
// 型を先に決めておくと、値を書くときにタイプミスや項目漏れをエディタが警告してくれる。

// ユーザーの権限（要件の4段階ロール）。この4つの文字列以外は入れられない。
export type UserRole = "ADMIN" | "OPERATOR" | "LEADER" | "USER";

// ログイン中ユーザーの情報（ヘッダーやマイページ表示に使う分だけ）
export interface CurrentUser {
  displayId: string; // 画面表示用のID（例: "000101"）
  realName: string; // 本名（例: "佐藤 健太"）
  nickname: string; // ニックネーム
  avatarText: string; // アバターに出す1文字（例: "佐"）
  granLevel: number; // GRANレベル（100〜999）
  classLabel: string; // 階級ラベル（例: "B級"）
  rankInClass: number; // 規定レベル内順位
  teamName: string; // 所属チーム名
  role: UserRole; // 権限
  isAdminPreview: boolean; // 管理者バナーを出すか（ADMIN/OPERATORのプレビュー用）
}

// 「要対応」カードの緊急度。残り日数によって色が変わる。
//  danger = 3日未満(赤) / warning = 3〜7日(オレンジ) / normal = 8日以上(緑)
export type ActionUrgency = "danger" | "warning" | "normal";

// 「要対応」カード1件分のデータ
export interface RequiredAction {
  id: string;
  tournamentDate: string; // 大会日（表示用文字列 例: "2026/09/20 (日)"）
  tournamentTitle: string; // 大会名
  daysLeft: number; // 対応期限までの残り日数
  urgency: ActionUrgency; // 緊急度（色分けに使う）
  actionLabel: string; // 必要な対応の説明（例: "未定枠があります"）
}

// エントリー済み大会1件分のデータ（カルーセルで1枚ずつ表示する）
export interface EnteredTournament {
  id: string;
  displayId: string; // 大会ID表示用（例: "T-2026-0920"）
  title: string;
  dateTime: string; // 開催日時（例: "2026/09/20 (日) 09:00集合"）
  venue: string; // 会場
  categoryLevel: string; // 種目・規定階級（例: "ミックス団体戦 (B〜C級)"）
  fee: string; // 参加費用の表示（例: "¥20,000 (決済完了)"）
  applicantInfo: string; // エントリーチーム情報
  statusLabel: string; // ステータスバッジの文言（例: "要メンバー登録"）
  note: string; // 注意事項・連絡事項
}
