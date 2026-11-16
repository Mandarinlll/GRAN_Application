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
