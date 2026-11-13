// 開発用シード投入スクリプト。
//
// 目的:
//   - 大会登録機能（管理者側・別スコープ）が未実装のため、
//     大会日程ページ／エントリー機能を動作確認するためのテストデータを投入する。
//
// 実行:
//   npm run seed
//   （内部で `node --experimental-strip-types scripts/seed.ts` を実行）
//
// 冪等性:
//   - tournaments が既に存在する場合は大会シードをスキップする。
//   - テストチームも既に存在すれば作成しない。
//   - 既存のログインユーザーが居る場合、その1名をテストチームの代表者に紐付ける。
//     （誰も居なければテスト用アカウントを作成する）
//
// 注意:
//   このスクリプトは src/lib/db.ts（`@/` エイリアス不使用）を相対 import で読み込む。
//   SQL はスクリプト内に閉じて書く（本番のリポジトリ層とは独立した投入専用処理）。

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, NOW_JST } from "../src/lib/db.ts";

type Category =
  | "MEN_TEAM"
  | "WOMEN_TEAM"
  | "MIX_TEAM"
  | "SINGLES"
  | "DOUBLES";
type Tier = "A" | "AB" | "B" | "BC" | "C" | "CD" | "D" | "DE";
type Status = "OPEN" | "UPCOMING" | "CLOSED" | "FINISHED";

// -------------------- 日付ヘルパー（基準日からの相対日付で生成） --------------------

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// -------------------- 大会シードデータ --------------------

// gender_division を決定する。団体戦は category から導出、SINGLES / DOUBLES は指定必須。
function divisionOfCategory(
  category: Category,
  specified?: "MEN" | "WOMEN" | "MIXED" | null,
): "MEN" | "WOMEN" | "MIXED" {
  if (category === "MEN_TEAM") return "MEN";
  if (category === "WOMEN_TEAM") return "WOMEN";
  if (category === "MIX_TEAM") return "MIXED";
  if (!specified) {
    throw new Error(`[seed] ${category} には gender_division の指定が必要です`);
  }
  return specified;
}

interface SeedTournament {
  title: string;
  category: Category;
  // SINGLES / DOUBLES は必須（団体戦は category から導出）
  genderDivision?: "MEN" | "WOMEN" | "MIXED";
  tier: Tier;
  offsetDays: number; // 今日からの相対日数（負=過去）
  startTime: string;
  endTime: string;
  venue: string;
  courtInfo: string;
  description: string;
  capacity: number;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  entryFee: number;
  status: Status;
  // 確定エントリーを何件ダミー投入するか（残枠・満員の見た目確認用）。
  dummyConfirmed: number;
}

const SEED_TOURNAMENTS: SeedTournament[] = [
  {
    title: "第14回 GRANカップ秋季ミックス団体戦",
    category: "MIX_TEAM",
    tier: "B",
    offsetDays: 14,
    startTime: "09:00",
    endTime: "16:30",
    venue: "有明テニスの森公園",
    courtInfo: "砂入り人工芝（オムニ）4面使用 / 有料駐車場有",
    description:
      "予選リーグ（各組3〜4チーム）後、本戦順位別トーナメントを実施（全チーム最低3対戦保証）。試合方式：6ゲーム先取（ノーアド）。使用球：ダンロップフォート（本部支給）。荒天時は当日朝7:00までにアプリ・メールで可否連絡。",
    capacity: 16,
    teamSizeMin: 6,
    teamSizeMax: 6,
    entryFee: 20000,
    status: "OPEN",
    dummyConfirmed: 12,
  },
  {
    title: "秋季シングルスチャレンジ B級",
    category: "SINGLES",
    genderDivision: "MEN",
    tier: "B",
    offsetDays: 25,
    startTime: "08:30",
    endTime: "17:00",
    venue: "駒沢オリンピック公園",
    courtInfo: "ハードコート6面",
    description:
      "予選リーグ後、順位別トーナメント。6ゲーム先取（ノーアド）。全選手にGRANレーティング変動が付与されます。",
    capacity: 32,
    teamSizeMin: null,
    teamSizeMax: null,
    entryFee: 4000,
    status: "OPEN",
    dummyConfirmed: 10,
  },
  {
    title: "GRAN 10月オープンダブルス",
    category: "DOUBLES",
    genderDivision: "MIXED",
    tier: "C",
    offsetDays: 32,
    startTime: "09:00",
    endTime: "16:00",
    venue: "昭和の森テニスセンター",
    courtInfo: "ハードコート（インドア4面）",
    description:
      "ペア戦。予選リーグ後、順位別トーナメント。6ゲーム先取（ノーアド）。",
    capacity: 24,
    teamSizeMin: null,
    teamSizeMax: null,
    entryFee: 8000,
    status: "OPEN",
    dummyConfirmed: 6,
  },
  {
    title: "第5回 クラシックB級チャレンジ",
    category: "MEN_TEAM",
    tier: "BC",
    offsetDays: 10,
    startTime: "08:30",
    endTime: "17:30",
    venue: "横浜テニスクラブ",
    courtInfo: "砂入り人工芝（オムニ6面）",
    description:
      "4ダブルス団体戦（最低8名）。予選リーグ後、順位別トーナメント。6ゲーム先取（ノーアド）。",
    capacity: 16,
    teamSizeMin: 8,
    teamSizeMax: 8,
    entryFee: 24000,
    status: "OPEN",
    dummyConfirmed: 13, // 13/16 = 81% → 残りわずか
  },
  {
    title: "第79回 GRAN サテライトC級カップ",
    category: "SINGLES",
    genderDivision: "MEN",
    tier: "C",
    offsetDays: 7,
    startTime: "09:00",
    endTime: "17:00",
    venue: "昭和の森テニスセンター",
    courtInfo: "ハードコート（インドア4面）",
    description:
      "満員のためキャンセル待ち受付中。空き枠が発生した場合、順番待ち最上位者へ自動案内メールが届きます（承諾期限24時間）。",
    capacity: 16,
    teamSizeMin: null,
    teamSizeMax: null,
    entryFee: 5000,
    status: "OPEN",
    dummyConfirmed: 16, // 満員
  },
  {
    title: "GRAN 女子団体戦 BC級カップ",
    category: "WOMEN_TEAM",
    tier: "BC",
    offsetDays: 45,
    startTime: "09:30",
    endTime: "16:30",
    venue: "大宮第二公園テニスコート",
    courtInfo: "砂入り人工芝（オムニ8面）",
    description: "3ダブルス団体戦（最低6名）。予選リーグ後、順位別トーナメント。",
    capacity: 20,
    teamSizeMin: 6,
    teamSizeMax: 6,
    entryFee: 18000,
    status: "OPEN",
    dummyConfirmed: 4,
  },
  {
    title: "GRAN プレミアA級シリーズ 第3戦",
    category: "SINGLES",
    genderDivision: "MEN",
    tier: "A",
    offsetDays: 60,
    startTime: "08:30",
    endTime: "18:00",
    venue: "千葉ベイサイドTC",
    courtInfo: "ハードコート（アウトドア6面）",
    description: "上級者向けA級シングルス。全選手にGRANレーティング変動が付与されます。",
    capacity: 32,
    teamSizeMin: null,
    teamSizeMax: null,
    entryFee: 6000,
    status: "OPEN",
    dummyConfirmed: 8,
  },
  {
    title: "【終了】GRAN 春季 DE級フェスティバル",
    category: "DOUBLES",
    genderDivision: "MIXED",
    tier: "DE",
    offsetDays: -30,
    startTime: "09:00",
    endTime: "15:00",
    venue: "川崎リバーサイドTC",
    courtInfo: "クレーコート4面",
    description: "ビギナー向けダブルス大会（終了済）。",
    capacity: 24,
    teamSizeMin: null,
    teamSizeMax: null,
    entryFee: 4000,
    status: "FINISHED",
    dummyConfirmed: 24,
  },
];

// -------------------- 投入処理 --------------------

function countRows(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
    c: number;
  };
  return row.c;
}

// ダミーの確定エントリーを投入する（残枠・満員の見た目確認用）。
// user_id は代表者（repUserId）を使うが、重複エントリー制約を避けるため
// ここでは entries のみ（1大会1件の代表エントリー）に留め、残りは「件数」をずらす。
// → 実際には複数ユーザーが必要なため、ダミーユーザーを必要数作って割り当てる。
function ensureDummyUsers(count: number, hash: string): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const loginId = `900${String(i).padStart(3, "0")}`; // 900000〜（テスト専用帯）
    const existing = db
      .prepare("SELECT id FROM users WHERE login_id = ?")
      .get(loginId) as { id: string } | undefined;
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO users (
        id, login_id, email, password_hash, role, is_admin, status,
        is_initial_login, real_name, kana_name, nickname, gender, birth_date,
        phone_number, declared_class, gran_level, is_level_calibrated, rated_match_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'USER', 0, 'ACTIVE', 0, ?, ?, ?, 'OTHER', '2000-01-01', '09000000000', 'C', 500, 1, 0, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      id,
      loginId,
      `dummy${i}@example.test`,
      hash,
      `ダミー 選手${i}`,
      `ダミー センシュ${i}`,
      `dummy${i}`,
    );
    ids.push(id);
  }
  return ids;
}

// -------------------- データタブ確認用シード（data-tab-restructure） --------------------
//
// マイデータ／出場データ／ランキング画面の手動確認用。以下のケースを含める:
//   - シリーズ・サーフェス・性別区分あり／なし（未設定区分）
//   - 対戦相手のゲスト・未定メンバー、不戦（BYE）、引き分け
//   - 結果未確定の出場（tournament_results 無し）
//   - キャンセル／キャンセル待ちエントリー（出場履歴に出ないこと）
//   - GRANレベルの同値ユーザー（ランキングのタイブレーク）、未査定ユーザー
// 冪等性: タイトル先頭の目印（DATA_SEED_MARK）が既にあればスキップする。

const DATA_SEED_MARK = "【データ確認】";

type MemberSpec =
  | { type: "REGISTERED"; userId: string }
  | { type: "GUEST"; guestName: string }
  | { type: "PENDING" };

function ensureUser(
  loginId: string,
  nickname: string,
  gender: "MALE" | "FEMALE" | "OTHER",
  granLevel: number,
  calibrated: boolean,
  ratedMatchCount: number,
  hash: string,
): string {
  const existing = db
    .prepare("SELECT id FROM users WHERE login_id = ?")
    .get(loginId) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (
      id, login_id, email, password_hash, role, is_admin, status,
      is_initial_login, real_name, kana_name, nickname, gender, birth_date,
      phone_number, declared_class, gran_level, is_level_calibrated, rated_match_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'USER', 0, 'ACTIVE', 0, ?, ?, ?, ?, '1998-04-01', '09000000000', 'C', ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
  ).run(
    id,
    loginId,
    `seed${loginId}@example.test`,
    hash,
    `実名 ${nickname}`,
    `ジツメイ ${nickname}`,
    nickname,
    gender,
    granLevel,
    calibrated ? 1 : 0,
    ratedMatchCount,
  );
  return id;
}

function ensureTeam(name: string, leaderUserId: string): string {
  const existing = db
    .prepare("SELECT id FROM teams WHERE leader_user_id = ?")
    .get(leaderUserId) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO teams (id, name, leader_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
  ).run(id, name, leaderUserId);
  return id;
}

function ensureSeries(name: string): string {
  const existing = db
    .prepare("SELECT id FROM tournament_series WHERE name = ?")
    .get(name) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare("INSERT INTO tournament_series (id, name) VALUES (?, ?)").run(
    id,
    name,
  );
  return id;
}

function insertEntry(
  tournamentId: string,
  userId: string,
  category: Category,
  status: "CONFIRMED" | "WAITING" | "CANCELLED" | "ATTENDED",
  teamId: string | null,
  members: MemberSpec[],
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO entries (
      id, tournament_id, user_id, team_id, category, status, is_proxy,
      applied_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ${NOW_JST}, ${NOW_JST}, ${NOW_JST})`,
  ).run(id, tournamentId, userId, teamId, category, status);
  members.forEach((m, i) => {
    db.prepare(
      `INSERT INTO entry_members (
        id, entry_id, member_type, user_id, guest_name, is_pending, order_no,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      randomUUID(),
      id,
      m.type,
      m.type === "REGISTERED" ? m.userId : null,
      m.type === "GUEST" ? m.guestName : null,
      m.type === "PENDING" ? 1 : 0,
      i + 1,
    );
  });
  return id;
}

function insertMatch(
  tournamentId: string,
  round: number,
  num: number,
  entry1: string,
  entry2: string | null, // null = 不戦（BYE）
  winner: string | null, // FINISHED で null = 引き分け
  score: string | null,
  status: "READY" | "PLAYING" | "FINISHED" = "FINISHED",
): void {
  db.prepare(
    `INSERT INTO tournament_matches (
      id, tournament_id, round_number, match_number, court_name,
      entry1_id, entry2_id, winner_entry_id, score_detail, match_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
  ).run(
    randomUUID(),
    tournamentId,
    round,
    num,
    `コート${num}`,
    entry1,
    entry2,
    winner,
    score,
    status,
  );
}

interface DataSeedTournament {
  key: string;
  title: string;
  category: Category;
  tier: Tier;
  offsetDays: number;
  venue: string;
  surface: "HARD" | "CLAY" | "ARTIFICIAL_GRASS" | "OTHER" | null;
  series: string | null;
  genderDivision: "MEN" | "WOMEN" | "MIXED" | null;
}

const DATA_SEED_TOURNAMENTS: DataSeedTournament[] = [
  { key: "t1", title: "第1戦 シングルス", category: "SINGLES", tier: "C", offsetDays: -150, venue: "駒沢オリンピック公園", surface: "HARD", series: "GRANシリーズ", genderDivision: "MEN" },
  { key: "t2", title: "ミックスダブルス", category: "DOUBLES", tier: "C", offsetDays: -100, venue: "川崎リバーサイドTC", surface: "CLAY", series: "GRANシリーズ", genderDivision: "MIXED" },
  { key: "t3", title: "男子団体戦", category: "MEN_TEAM", tier: "BC", offsetDays: -60, venue: "横浜テニスクラブ", surface: "ARTIFICIAL_GRASS", series: "クラシックシリーズ", genderDivision: "MEN" },
  // 結果未確定・サーフェス/シリーズ未設定（個人戦の性別区分は必須のため設定する）。
  { key: "t4", title: "未設定シングルス", category: "SINGLES", tier: "C", offsetDays: -30, venue: "昭和の森テニスセンター", surface: null, series: null, genderDivision: "MEN" },
  { key: "t5", title: "ミックス団体戦", category: "MIX_TEAM", tier: "B", offsetDays: -10, venue: "有明テニスの森公園", surface: "OTHER", series: "クラシックシリーズ", genderDivision: "MIXED" },
  // キャンセル／キャンセル待ち（出場履歴に現れないこと）。
  { key: "t6", title: "キャンセル済み大会", category: "SINGLES", tier: "D", offsetDays: -45, venue: "千葉ベイサイドTC", surface: "HARD", series: null, genderDivision: "WOMEN" },
  { key: "t7", title: "キャンセル待ち大会", category: "SINGLES", tier: "D", offsetDays: -20, venue: "千葉ベイサイドTC", surface: "HARD", series: null, genderDivision: "WOMEN" },
];

function seedDataTab(
  repUserId: string,
  repTeamId: string,
  teamMemberIds: string[],
  hash: string,
): void {
  const already = db
    .prepare("SELECT 1 FROM tournaments WHERE title LIKE ?")
    .get(`${DATA_SEED_MARK}%`);
  if (already) {
    console.log("[seed] データタブ確認用データは既に存在します（スキップ）");
    return;
  }

  // 代表者の現在レベルを基準に履歴を逆算する。未査定の初期値なら査定済みにする。
  const rep = db
    .prepare("SELECT gran_level, is_level_calibrated FROM users WHERE id = ?")
    .get(repUserId) as { gran_level: number; is_level_calibrated: number };
  let level = rep.gran_level;
  if (level < 300 || !rep.is_level_calibrated) {
    level = 520;
    db.prepare(
      `UPDATE users SET gran_level = ?, is_level_calibrated = 1, rated_match_count = 12,
         gender = COALESCE(gender, 'MALE'), updated_at = ${NOW_JST} WHERE id = ?`,
    ).run(level, repUserId);
    console.log("[seed] 代表者を GRANレベル520（査定済み）に更新しました");
  }

  // 対戦相手ユーザー。
  const opp = ensureUser("910001", "ソウタ", "MALE", 500, true, 8, hash);
  const opp2 = ensureUser("910002", "ハルカ", "FEMALE", 480, true, 6, hash);
  const opp3 = ensureUser("910003", "リョウ", "MALE", 540, true, 15, hash);
  const oppLeader = ensureUser("910004", "ダイキ", "MALE", 560, true, 20, hash);
  const oppTeam = ensureTeam("Team Smash", oppLeader);

  // ランキング用ユーザー（C階級で同値レベルを含む / 種目別用に性別も混在）。
  ensureUser("910010", "同値レベルA", "MALE", level, true, 30, hash); // 代表者と同値
  ensureUser("910011", "同値レベルB", "FEMALE", level, true, 5, hash);
  ensureUser("910012", "上位ミドル", "FEMALE", 549, true, 18, hash);
  ensureUser("910013", "階級下限", "OTHER", 450, true, 3, hash);
  ensureUser("910014", "B級上位", "MALE", 690, true, 40, hash);
  ensureUser("910015", "B級同値1", "FEMALE", 650, true, 22, hash);
  ensureUser("910016", "B級同値2", "FEMALE", 650, true, 22, hash);
  ensureUser("910017", "未査定ユーザー", "MALE", 500, false, 0, hash);

  const seriesIds = new Map<string, string>();
  const tIds = new Map<string, string>();
  for (const t of DATA_SEED_TOURNAMENTS) {
    const seriesId = t.series
      ? (seriesIds.get(t.series) ?? ensureSeries(t.series))
      : null;
    if (t.series && seriesId) seriesIds.set(t.series, seriesId);
    const eventDate = ymd(addDays(new Date(), t.offsetDays));
    const id = randomUUID();
    tIds.set(t.key, id);
    db.prepare(
      `INSERT INTO tournaments (
        id, title, category, tier, event_date, start_time, end_time,
        venue, court_info, image_url, description, capacity,
        team_size_min, team_size_max, entry_fee, status,
        entry_start_at, entry_end_at, alert_threshold,
        surface, series_id, gender_division, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, '09:00', '16:00', ?, NULL, NULL, NULL, 16,
        NULL, NULL, 4000, 'FINISHED', ?, ?, NULL, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      id,
      `${DATA_SEED_MARK}${t.title}`,
      t.category,
      t.tier,
      eventDate,
      t.venue,
      `${ymd(addDays(new Date(), t.offsetDays - 60))} 00:00:00`,
      `${ymd(addDays(new Date(), t.offsetDays - 7))} 23:59:59`,
      t.surface,
      seriesId,
      divisionOfCategory(t.category, t.genderDivision),
    );
  }
  const tid = (k: string): string => tIds.get(k) as string;
  const me = (): MemberSpec[] => [{ type: "REGISTERED", userId: repUserId }];

  // t1 シングルス: 2勝1敗（準優勝）。
  {
    const mine = insertEntry(tid("t1"), repUserId, "SINGLES", "ATTENDED", null, me());
    const o1 = insertEntry(tid("t1"), opp, "SINGLES", "ATTENDED", null, [{ type: "REGISTERED", userId: opp }]);
    const o2 = insertEntry(tid("t1"), opp2, "SINGLES", "ATTENDED", null, [{ type: "REGISTERED", userId: opp2 }]);
    const o3 = insertEntry(tid("t1"), opp3, "SINGLES", "ATTENDED", null, [{ type: "REGISTERED", userId: opp3 }]);
    insertMatch(tid("t1"), 1, 1, mine, o1, mine, "6-3");
    insertMatch(tid("t1"), 2, 1, mine, o2, mine, "6-4");
    insertMatch(tid("t1"), 3, 1, o3, mine, o3, "4-6");
  }

  // t2 ダブルス: ゲスト・未定の相手、不戦、引き分け。
  {
    const mine = insertEntry(tid("t2"), repUserId, "DOUBLES", "ATTENDED", null, [
      { type: "REGISTERED", userId: repUserId },
      { type: "GUEST", guestName: "山田ゲスト太郎" },
    ]);
    const o1 = insertEntry(tid("t2"), opp2, "DOUBLES", "ATTENDED", null, [
      { type: "REGISTERED", userId: opp2 },
      { type: "GUEST", guestName: "鈴木ゲスト花子" },
    ]);
    const o2 = insertEntry(tid("t2"), opp, "DOUBLES", "ATTENDED", null, [
      { type: "REGISTERED", userId: opp },
      { type: "PENDING" },
    ]);
    const o3 = insertEntry(tid("t2"), opp3, "DOUBLES", "ATTENDED", null, [
      { type: "REGISTERED", userId: opp3 },
      { type: "REGISTERED", userId: opp2 },
    ]);
    insertMatch(tid("t2"), 1, 1, mine, o1, mine, "6-2");
    insertMatch(tid("t2"), 2, 1, mine, null, mine, null); // 不戦（統計・一覧から除外）
    insertMatch(tid("t2"), 3, 1, mine, o2, null, "3-3"); // 引き分け（統計除外）
    insertMatch(tid("t2"), 4, 1, o3, mine, o3, "6-4");
  }

  // t3 男子団体戦: 対戦チーム名表示。同日に複数試合。
  {
    const mine = insertEntry(
      tid("t3"),
      repUserId,
      "MEN_TEAM",
      "ATTENDED",
      repTeamId,
      [repUserId, ...teamMemberIds.slice(0, 3)].map((u) => ({ type: "REGISTERED" as const, userId: u })),
    );
    const o1 = insertEntry(tid("t3"), oppLeader, "MEN_TEAM", "ATTENDED", oppTeam, [
      { type: "REGISTERED", userId: oppLeader },
      { type: "GUEST", guestName: "佐々木ゲスト" },
    ]);
    insertMatch(tid("t3"), 1, 1, mine, o1, mine, "2-1");
    insertMatch(tid("t3"), 2, 1, o1, mine, o1, "2-0");
  }

  // t4 結果未確定（tournament_results 無し）。
  {
    const mine = insertEntry(tid("t4"), repUserId, "SINGLES", "ATTENDED", null, me());
    const o1 = insertEntry(tid("t4"), opp, "SINGLES", "ATTENDED", null, [{ type: "REGISTERED", userId: opp }]);
    insertMatch(tid("t4"), 1, 1, mine, o1, mine, "7-5");
  }

  // t5 ミックス団体戦: チーム名なしの相手（個人表示へフォールバック）。
  {
    const mine = insertEntry(
      tid("t5"),
      repUserId,
      "MIX_TEAM",
      "ATTENDED",
      repTeamId,
      [repUserId, ...teamMemberIds.slice(0, 5)].map((u) => ({ type: "REGISTERED" as const, userId: u })),
    );
    const o1 = insertEntry(tid("t5"), opp3, "MIX_TEAM", "ATTENDED", null, [
      { type: "REGISTERED", userId: opp3 },
      { type: "REGISTERED", userId: opp2 },
    ]);
    insertMatch(tid("t5"), 1, 1, mine, o1, mine, "2-1");
  }

  // t6 キャンセル／t7 キャンセル待ち: 出場履歴・統計に現れない。
  insertEntry(tid("t6"), repUserId, "SINGLES", "CANCELLED", null, me());
  insertEntry(tid("t7"), repUserId, "SINGLES", "WAITING", null, me());

  // GRANレベル履歴（現在レベルから逆算して連続させる）。t4 は未確定のため行を作らない。
  // 同一日時の並び順確認のため t2 と t3 の間は別日付、t5 の diff=0 も含める。
  const results: Array<{ key: string; rank: string; points: number | null; diff: number }> = [
    { key: "t1", rank: "T1_RUNNER_UP", points: 20, diff: 15 },
    { key: "t2", rank: "PARTICIPATED", points: 5, diff: -6 },
    { key: "t3", rank: "L2_WINNER", points: 10, diff: 0 },
    { key: "t5", rank: "T1_WINNER", points: 30, diff: 8 },
  ];
  let post = level;
  const rows = [];
  for (const r of [...results].reverse()) {
    const pre = post - r.diff;
    rows.push({ ...r, pre, post });
    post = pre;
  }
  for (const r of rows.reverse()) {
    const t = DATA_SEED_TOURNAMENTS.find((x) => x.key === r.key)!;
    const recordedAt = `${ymd(addDays(new Date(), t.offsetDays))} 18:00:00`;
    db.prepare(
      `INSERT INTO tournament_results (
        id, tournament_id, team_id, user_id, rank_type, awarded_points,
        pre_gran_level, gran_level_diff, post_gran_level, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      tid(r.key),
      t.category.endsWith("_TEAM") ? repTeamId : null,
      repUserId,
      r.rank,
      r.points,
      r.pre,
      r.diff,
      r.post,
      recordedAt,
    );
  }

  console.log(
    `[seed] データタブ確認用データを投入: 大会${DATA_SEED_TOURNAMENTS.length}件 / 結果${results.length}件`,
  );
}

async function main(): Promise<void> {
  console.log("[seed] 開始");

  const hash = await bcrypt.hash("password123", 10);
  const today = new Date();

  // 1) テスト用の代表者ユーザーを決定する。
  //    既存の一般ユーザー（login_id >= 000101）が居ればその1名を代表者に。
  //    居なければテスト代表者アカウントを作成する。
  let repUser = db
    .prepare(
      `SELECT id, email, login_id FROM users
        WHERE CAST(login_id AS INTEGER) >= 101 AND CAST(login_id AS INTEGER) < 900000
        ORDER BY CAST(login_id AS INTEGER) ASC LIMIT 1`,
    )
    .get() as { id: string; email: string; login_id: string } | undefined;

  if (!repUser) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO users (
        id, login_id, email, password_hash, role, is_admin, status,
        is_initial_login, real_name, kana_name, nickname, gender, birth_date,
        phone_number, declared_class, gran_level, is_level_calibrated, rated_match_count,
        created_at, updated_at
      ) VALUES (?, '000101', 'leader@example.test', ?, 'LEADER', 0, 'ACTIVE', 0,
        '佐藤 健太', 'サトウ ケンタ', 'ケンタ', 'MALE', '1995-05-05',
        '09011112222', 'B', 650, 1, 4, ${NOW_JST}, ${NOW_JST})`,
    ).run(id, hash);
    repUser = { id, email: "leader@example.test", login_id: "000101" };
    console.log(
      "[seed] テスト代表者アカウントを作成: leader@example.test / password123",
    );
  } else {
    console.log(`[seed] 既存ユーザー(${repUser.login_id})を代表者に紐付けます`);
  }

  // 2) テストチームを作成（まだ無ければ）し、代表者を LEADER に昇格する。
  let team = db
    .prepare("SELECT id FROM teams WHERE leader_user_id = ?")
    .get(repUser.id) as { id: string } | undefined;

  if (!team) {
    const teamId = randomUUID();
    db.prepare(
      `INSERT INTO teams (id, name, leader_user_id, created_at, updated_at)
       VALUES (?, 'Team GRAN Apex', ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(teamId, repUser.id);
    team = { id: teamId };

    // 代表者を LEADER ロールへ。
    db.prepare(
      `UPDATE users SET role = 'LEADER', updated_at = ${NOW_JST} WHERE id = ?`,
    ).run(repUser.id);

    // 代表者自身をチームメンバーに加える。
    db.prepare(
      `INSERT INTO team_members (id, team_id, user_id, joined_at)
       VALUES (?, ?, ?, ${NOW_JST})`,
    ).run(randomUUID(), team.id, repUser.id);

    console.log("[seed] テストチーム 'Team GRAN Apex' を作成しました");
  } else {
    console.log("[seed] テストチームは既に存在します（スキップ）");
  }

  // 3) チームメンバーを数名追加（団体戦のメンバー選択UI確認用）。
  const memberUserIds = ensureDummyUsers(5, hash);
  for (const uid of memberUserIds) {
    const exists = db
      .prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(team.id, uid);
    if (!exists) {
      db.prepare(
        `INSERT INTO team_members (id, team_id, user_id, joined_at)
         VALUES (?, ?, ?, ${NOW_JST})`,
      ).run(randomUUID(), team.id, uid);
    }
  }

  // 4) 大会シード（既に存在すればスキップ）。
  if (countRows("tournaments") > 0) {
    console.log("[seed] tournaments は既に存在します（大会シードをスキップ）");
    seedDataTab(repUser.id, team.id, memberUserIds, hash);
    console.log("[seed] 完了");
    return;
  }

  // ダミー確定エントリー割り当て用のユーザープール（十分な人数を用意）。
  const maxDummy = Math.max(
    ...SEED_TOURNAMENTS.map((t) => t.dummyConfirmed),
    0,
  );
  const pool = ensureDummyUsers(maxDummy, hash);

  for (const t of SEED_TOURNAMENTS) {
    const eventDate = ymd(addDays(today, t.offsetDays));
    const entryStart = `${ymd(addDays(today, t.offsetDays - 60))} 00:00:00`;
    const entryEnd = `${ymd(addDays(today, t.offsetDays - 7))} 23:59:59`;
    const tournamentId = randomUUID();

    db.prepare(
      `INSERT INTO tournaments (
        id, title, category, tier, event_date, start_time, end_time,
        venue, court_info, image_url, description, capacity,
        team_size_min, team_size_max, entry_fee, status,
        entry_start_at, entry_end_at, alert_threshold, gender_division, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      tournamentId,
      t.title,
      t.category,
      t.tier,
      eventDate,
      t.startTime,
      t.endTime,
      t.venue,
      t.courtInfo,
      t.description,
      t.capacity,
      t.teamSizeMin,
      t.teamSizeMax,
      t.entryFee,
      t.status,
      entryStart,
      entryEnd,
      divisionOfCategory(t.category, t.genderDivision),
    );

    // ダミー確定エントリー（残枠・満員の見た目用）。各ダミーユーザーで1件ずつ。
    for (let i = 0; i < t.dummyConfirmed; i++) {
      const uid = pool[i];
      if (!uid) break;
      db.prepare(
        `INSERT INTO entries (
          id, tournament_id, user_id, team_id, category, status, is_proxy,
          applied_at, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, 'CONFIRMED', 0, ${NOW_JST}, ${NOW_JST}, ${NOW_JST})`,
      ).run(randomUUID(), tournamentId, uid, t.category);
    }

    console.log(
      `[seed] 大会投入: ${t.title}（${eventDate} / 確定${t.dummyConfirmed}件）`,
    );
  }

  seedDataTab(repUser.id, team.id, memberUserIds, hash);
  console.log("[seed] 完了");
}

main().catch((e) => {
  console.error("[seed] エラー:", e);
  process.exit(1);
});
