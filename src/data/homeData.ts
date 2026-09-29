// home画面で使う「固定データ」。
// 本来はデータベースから取ってくる部分だが、今はまだDBを繋がないので、
// ここに手で書いた値を使う。将来はこのファイルを「DBから取得する処理」に差し替えるだけでよい。

import type {
  CurrentUser,
  EnteredTournament,
  RequiredAction,
} from "@/types/home";

// import type { ... } from "@/types/home" は
//   「@/types/home で定義した型を、この行で借りてくる」という意味。
//   @/ は tsconfig.json で src/ を指すよう設定したエイリアス。

// ---- ログイン中ユーザー（元 home.html の佐藤健太さん） ----
export const currentUser: CurrentUser = {
  displayId: "000101",
  realName: "佐藤 健太",
  nickname: "ケンタ",
  avatarText: "佐",
  granLevel: 540,
  classLabel: "B級",
  rankInClass: 14,
  teamName: "Team GRAN Apex",
  role: "LEADER",
  isAdminPreview: false, // true にすると上部の管理者バナーが出る
};

// ---- 要対応リスト（元 home.html の「要対応」カード） ----
export const requiredActions: RequiredAction[] = [
  {
    id: "act-1",
    tournamentDate: "2026/09/20 (日)",
    tournamentTitle: "第14回 GRANカップ秋季ミックス団体戦",
    daysLeft: 2,
    urgency: "danger", // 残り2日なので赤
    actionLabel: "未定枠があります",
  },
];

// ---- エントリー済み大会（元 home.html のカルーセル） ----
// 型 EnteredTournament[] は「EnteredTournament の配列（複数件）」という意味。
export const enteredTournaments: EnteredTournament[] = [
  {
    id: "t-2026-0920",
    displayId: "T-2026-0920",
    title: "第14回 GRANカップ秋季ミックス団体戦",
    dateTime: "2026/09/20 (日) 09:00集合",
    venue: "有明テニスの森公園（オムニ4面）",
    categoryLevel: "ミックス団体戦 (B〜C級)",
    fee: "¥20,000 (決済完了)",
    applicantInfo: "Team GRAN Apex 代表: 佐藤 健太",
    statusLabel: "要メンバー登録",
    note: "第3ペア選手が「未定枠」のままです。9/10までに登録してください。",
  },
  {
    id: "t-2026-1012",
    displayId: "T-2026-1012",
    title: "秋季シングルスチャレンジ B級",
    dateTime: "2026/10/12 (日) 08:30集合",
    venue: "駒沢オリンピック公園（ハード6面）",
    categoryLevel: "シングルス (B級)",
    fee: "¥4,000 (決済完了)",
    applicantInfo: "個人エントリー: 佐藤 健太",
    statusLabel: "エントリー確定",
    note: "特に対応事項はありません。当日は開始30分前に集合してください。",
  },
];
