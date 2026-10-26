// 大会（tournaments）ドメインの型定義。
// DB ENUM と同期したリテラル型（コーディング規約 3.3 / db-schema.md 準拠）。

// 種目区分（tournament_category_enum）
export type TournamentCategory =
  | "MEN_TEAM" // 男子団体戦
  | "WOMEN_TEAM" // 女子団体戦
  | "MIX_TEAM" // ミックス団体戦
  | "SINGLES" // シングルス
  | "DOUBLES"; // ダブルス

// 階級区分（tournament_tier_enum / 8段階）
export type TournamentTier =
  | "A"
  | "AB"
  | "B"
  | "BC"
  | "C"
  | "CD"
  | "D"
  | "DE";

// 大会ステータス（tournament_status_enum）
export type TournamentStatus =
  | "DRAFT" // 未公開
  | "UPCOMING" // 受付前
  | "OPEN" // 受付中
  | "CLOSED" // 締め切り
  | "FINISHED" // 終了
  | "CANCELLED"; // 中止

// tournaments テーブル1行に対応するアプリ内部表現。
export interface Tournament {
  id: string;
  title: string;
  category: TournamentCategory;
  tier: TournamentTier;
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string | null;
  venue: string;
  courtInfo: string | null;
  imageUrl: string | null;
  description: string | null;
  capacity: number;
  teamSizeMin: number | null; // 団体戦の最低人数
  teamSizeMax: number | null; // 団体戦の最大人数
  entryFee: number; // 円
  status: TournamentStatus;
  entryStartAt: string;
  entryEndAt: string;
  copyFromId: string | null;
  alertThreshold: number | null;
  drawPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// 大会一覧・詳細の表示に使う集計付きビューモデル。
// confirmedCount は status=CONFIRMED のエントリー数（残枠算出の分子）。
export interface TournamentWithStats extends Tournament {
  confirmedCount: number; // 確定エントリー数
  waitingCount: number; // キャンセル待ち人数
  remaining: number; // 残り枠数（capacity - confirmedCount、0未満は0）
  // 空き状況の派生ステータス（残枠ゼロ=FULL / 75%以上=FEW / それ以外=OPEN）。
  // 大会自体の status が受付中以外（CLOSED/FINISHED/CANCELLED等）はそちらを優先表示する。
  capacityStatus: "OPEN" | "FEW" | "FULL";
}

// 種目が団体戦系か（代表者のみ申込可能 & チーム必須）を判定するためのヘルパー集合。
export const TEAM_CATEGORIES: readonly TournamentCategory[] = [
  "MEN_TEAM",
  "WOMEN_TEAM",
  "MIX_TEAM",
] as const;

// ダブルス（代表者のみ申込可 / 2名）
export const DOUBLES_CATEGORY: TournamentCategory = "DOUBLES";

// シングルス（個人申込）
export const SINGLES_CATEGORY: TournamentCategory = "SINGLES";

// 種目区分 → 日本語表示名。
export const CATEGORY_LABEL: Record<TournamentCategory, string> = {
  MEN_TEAM: "男子団体戦",
  WOMEN_TEAM: "女子団体戦",
  MIX_TEAM: "ミックス団体戦",
  SINGLES: "シングルス",
  DOUBLES: "ダブルス",
};

// 階級区分 → 日本語表示名。
export const TIER_LABEL: Record<TournamentTier, string> = {
  A: "A級",
  AB: "AB級",
  B: "B級",
  BC: "BC級",
  C: "C級",
  CD: "CD級",
  D: "D級",
  DE: "DE級",
};

// 大会ステータス → 日本語表示名。
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: "未公開",
  UPCOMING: "受付前",
  OPEN: "受付中",
  CLOSED: "締め切り",
  FINISHED: "終了",
  CANCELLED: "中止",
};
