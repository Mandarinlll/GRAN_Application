// データタブ（マイデータ／出場データ／ランキング）の動作確認・単体テスト用フィクスチャ。
//
// 使い方:
//   - 単体テスト: openDatabase(":memory:") で作ったDBに seedDataTabFixture(db) を流す。
//   - 開発DBへの投入: `npm run seed:data-test`（scripts/seed-data-test.ts）。
//
// 方針:
//   - ID・日付・レベルはすべて固定値にして、テストの期待値がぶれないようにする。
//   - 大会の開催日は過去日（2025/04〜2026/09）。出場履歴は「開催日 <= 今日」の大会のみ対象のため。
//   - このファイルは Node の --experimental-strip-types からも読み込むため、
//     `@/` エイリアスや相対 import を使わない（型 import のみ）。
//
// テストアカウント（パスワードは TEST_PASSWORD）:
//   01 テスト太郎   男性 C   520  … 主役。出場・試合・GRAN履歴が最も多い
//   02 テスト花子   女性 BC  610
//   03 テストA級    男性 A   905  … 最上位階級（昇格ポイントなし）
//   04 テストAB級   女性 AB  790
//   05 テストB級    男性 B   700
//   06 テスト同値   男性 C   520  … 01 と同レベル（階級内順位のタイブレーク確認）
//   07 テストCD級   女性 CD  410
//   08 テストD級    その他 D 300  … 種目別（男子・女子）には出ず、混合にのみ出る
//   09 テストDE級   男性 DE  180
//   10 テスト査定前 女性 -   100  … 未査定（ランキングから除外）

import type { DatabaseSync } from "node:sqlite";

export const TEST_PASSWORD = "password123";

type Gender = "MALE" | "FEMALE" | "OTHER";
type Tier = "A" | "AB" | "B" | "BC" | "C" | "CD" | "D" | "DE";
type Category = "MEN_TEAM" | "WOMEN_TEAM" | "MIX_TEAM" | "SINGLES" | "DOUBLES";
type Division = "MEN" | "WOMEN" | "MIXED";
type Surface = "HARD" | "CLAY" | "ARTIFICIAL_GRASS" | "OTHER";
type EntryStatus = "CONFIRMED" | "WAITING" | "CANCELLED" | "ATTENDED";
type MatchStatus = "READY" | "PLAYING" | "FINISHED";
type RankType = "PARTICIPATED" | "L2_WINNER" | "T1_RUNNER_UP" | "T1_WINNER";

export interface FixtureUser {
  id: string;
  loginId: string;
  email: string;
  nickname: string;
  realName: string;
  kanaName: string;
  gender: Gender;
  declaredClass: Tier;
  granLevel: number;
  calibrated: boolean;
  ratedMatchCount: number;
}

function user(
  no: number,
  nickname: string,
  gender: Gender,
  declaredClass: Tier,
  granLevel: number,
  calibrated: boolean,
  ratedMatchCount: number,
): FixtureUser {
  const nn = String(no).padStart(2, "0");
  return {
    id: `dt-user-${nn}`,
    loginId: `9200${nn}`,
    email: `datatest${nn}@example.test`,
    nickname,
    realName: `試験 ${nickname}`,
    kanaName: `シケン ${nickname}`,
    gender,
    declaredClass,
    granLevel,
    calibrated,
    ratedMatchCount,
  };
}

export const FIXTURE_USERS = {
  taro: user(1, "テスト太郎", "MALE", "C", 520, true, 14),
  hanako: user(2, "テスト花子", "FEMALE", "BC", 610, true, 10),
  aClass: user(3, "テストA級", "MALE", "A", 905, true, 40),
  abClass: user(4, "テストAB級", "FEMALE", "AB", 790, true, 25),
  bClass: user(5, "テストB級", "MALE", "B", 700, true, 18),
  sameLevel: user(6, "テスト同値", "MALE", "C", 520, true, 6),
  cdClass: user(7, "テストCD級", "FEMALE", "CD", 410, true, 8),
  dClass: user(8, "テストD級", "OTHER", "D", 300, true, 3),
  deClass: user(9, "テストDE級", "MALE", "DE", 180, true, 2),
  uncalibrated: user(10, "テスト査定前", "FEMALE", "C", 100, false, 0),
} as const;

export const FIXTURE_USER_LIST: readonly FixtureUser[] = Object.values(FIXTURE_USERS);

const U = FIXTURE_USERS;

// ---- チーム ----
interface FixtureTeam {
  id: string;
  name: string;
  leader: FixtureUser;
  members: FixtureUser[];
}

export const FIXTURE_TEAMS = {
  taro: { id: "dt-team-01", name: "テストチーム太郎", leader: U.taro, members: [U.taro, U.bClass, U.sameLevel, U.deClass] },
  smash: { id: "dt-team-02", name: "テストチームスマッシュ", leader: U.aClass, members: [U.aClass] },
  mix: { id: "dt-team-03", name: "テストミックス", leader: U.hanako, members: [U.hanako, U.cdClass] },
} satisfies Record<string, FixtureTeam>;

// ---- 大会シリーズ ----
export const FIXTURE_SERIES = {
  gran: { id: "dt-series-01", name: "テストGRANシリーズ" },
  classic: { id: "dt-series-02", name: "テストクラシックシリーズ" },
} as const;

// ---- 大会 ----
interface FixtureTournament {
  id: string;
  title: string;
  category: Category;
  division: Division;
  tier: Tier;
  eventDate: string;
  venue: string;
  surface: Surface | null;
  seriesId: string | null;
}

const TITLE_MARK = "【テスト】";

function tournament(
  no: number,
  title: string,
  category: Category,
  division: Division,
  tier: Tier,
  eventDate: string,
  venue: string,
  surface: Surface | null,
  seriesId: string | null,
): FixtureTournament {
  return {
    id: `dt-t${String(no).padStart(2, "0")}`,
    title: `${TITLE_MARK}${title}`,
    category,
    division,
    tier,
    eventDate,
    venue,
    surface,
    seriesId,
  };
}

const S = FIXTURE_SERIES;

export const FIXTURE_TOURNAMENTS = {
  t01: tournament(1, "春季シングルス C級", "SINGLES", "MEN", "C", "2025-04-12", "駒沢オリンピック公園", "HARD", S.gran.id),
  t02: tournament(2, "ミックスダブルス C級", "DOUBLES", "MIXED", "C", "2025-05-24", "川崎リバーサイドTC", "CLAY", S.gran.id),
  t03: tournament(3, "夏季男子団体戦 BC級", "MEN_TEAM", "MEN", "BC", "2025-07-19", "横浜テニスクラブ", "ARTIFICIAL_GRASS", S.classic.id),
  t04: tournament(4, "晩夏シングルス C級", "SINGLES", "MEN", "C", "2025-08-30", "有明テニスの森公園", "HARD", null),
  t05: tournament(5, "秋季ミックス団体戦 B級", "MIX_TEAM", "MIXED", "B", "2025-10-11", "有明テニスの森公園", "OTHER", S.classic.id),
  t06: tournament(6, "冬季男子ダブルス C級", "DOUBLES", "MEN", "C", "2025-12-06", "昭和の森テニスセンター", null, S.gran.id),
  t07: tournament(7, "女子シングルス BC級", "SINGLES", "WOMEN", "BC", "2026-01-24", "駒沢オリンピック公園", "HARD", S.gran.id),
  t08: tournament(8, "春季男子団体戦 C級", "MEN_TEAM", "MEN", "C", "2026-03-14", "横浜テニスクラブ", "ARTIFICIAL_GRASS", S.classic.id),
  // 結果未確定（tournament_results 無し・未消化の試合あり）
  t09: tournament(9, "初夏シングルス C級（結果未確定）", "SINGLES", "MEN", "C", "2026-06-20", "駒沢オリンピック公園", "HARD", S.gran.id),
  // テスト太郎がキャンセル／キャンセル待ち（出場履歴に出ないこと）
  t10: tournament(10, "キャンセル済み大会 D級", "SINGLES", "MEN", "D", "2026-08-22", "千葉ベイサイドTC", "HARD", null),
  t11: tournament(11, "キャンセル待ち大会 D級", "SINGLES", "MEN", "D", "2026-09-26", "千葉ベイサイドTC", "HARD", null),
} as const;

export const FIXTURE_TOURNAMENT_LIST: readonly FixtureTournament[] = Object.values(FIXTURE_TOURNAMENTS);

const T = FIXTURE_TOURNAMENTS;

// ---- エントリー ----
type Member = FixtureUser | { guest: string } | "PENDING";

interface FixtureEntry {
  id: string;
  tournament: FixtureTournament;
  applicant: FixtureUser;
  teamId: string | null;
  status: EntryStatus;
  members: Member[];
}

let entrySeq = 0;
function entry(
  t: FixtureTournament,
  applicant: FixtureUser,
  members: Member[] = [applicant],
  opts: { teamId?: string; status?: EntryStatus } = {},
): FixtureEntry {
  entrySeq += 1;
  return {
    id: `dt-e-${String(entrySeq).padStart(3, "0")}`,
    tournament: t,
    applicant,
    teamId: opts.teamId ?? null,
    status: opts.status ?? "ATTENDED",
    members,
  };
}

const TM = FIXTURE_TEAMS;

// 試合カード作成に使うため、エントリーを名前付きで定義する。
export const FIXTURE_ENTRIES = {
  // t01 シングルス（太郎: 2勝1敗で準優勝）
  t01Taro: entry(T.t01, U.taro),
  t01Same: entry(T.t01, U.sameLevel),
  t01B: entry(T.t01, U.bClass),
  t01A: entry(T.t01, U.aClass),
  // t02 ミックスダブルス（ゲスト・未定メンバー、不戦、引き分け）
  t02Taro: entry(T.t02, U.taro, [U.taro, { guest: "山田ゲスト太郎" }]),
  t02Hanako: entry(T.t02, U.hanako, [U.hanako, U.abClass]),
  t02Cd: entry(T.t02, U.cdClass, [U.cdClass, "PENDING"]),
  t02Same: entry(T.t02, U.sameLevel, [U.sameLevel, U.dClass]),
  // t03 男子団体戦（対戦チーム名で表示）
  t03Taro: entry(T.t03, U.taro, [U.taro, U.bClass, U.sameLevel, U.deClass], { teamId: TM.taro.id }),
  t03Smash: entry(T.t03, U.aClass, [U.aClass, { guest: "佐々木ゲスト" }], { teamId: TM.smash.id }),
  // t04 シングルス（太郎: 0勝1敗）
  t04Taro: entry(T.t04, U.taro),
  t04Same: entry(T.t04, U.sameLevel),
  t04B: entry(T.t04, U.bClass),
  // t05 ミックス団体戦（チーム名なしの相手は個人名表示にフォールバック）
  t05Taro: entry(T.t05, U.taro, [U.taro, U.abClass], { teamId: TM.taro.id }),
  t05Mix: entry(T.t05, U.hanako, [U.hanako, U.cdClass], { teamId: TM.mix.id }),
  t05NoTeam: entry(T.t05, U.bClass, [U.bClass, U.dClass]),
  // t06 男子ダブルス（サーフェス未設定）
  t06Taro: entry(T.t06, U.taro, [U.taro, U.sameLevel]),
  t06B: entry(T.t06, U.bClass, [U.bClass, U.deClass]),
  t06A: entry(T.t06, U.aClass, [U.aClass, { guest: "高橋ゲスト" }]),
  // t07 女子シングルス（太郎は不参加）
  t07Hanako: entry(T.t07, U.hanako),
  t07Ab: entry(T.t07, U.abClass),
  t07Cd: entry(T.t07, U.cdClass),
  // t08 男子団体戦
  t08Taro: entry(T.t08, U.taro, [U.taro, U.bClass, U.deClass], { teamId: TM.taro.id }),
  t08Smash: entry(T.t08, U.aClass, [U.aClass], { teamId: TM.smash.id }),
  // t09 結果未確定
  t09Taro: entry(T.t09, U.taro),
  t09B: entry(T.t09, U.bClass),
  t09Same: entry(T.t09, U.sameLevel),
  // t10 キャンセル済み／t11 キャンセル待ち
  t10Taro: entry(T.t10, U.taro, [U.taro], { status: "CANCELLED" }),
  t10B: entry(T.t10, U.bClass),
  t11Taro: entry(T.t11, U.taro, [U.taro], { status: "WAITING" }),
  t11Same: entry(T.t11, U.sameLevel),
} as const;

const E = FIXTURE_ENTRIES;

// ---- 試合 ----
interface FixtureMatch {
  id: string;
  tournament: FixtureTournament;
  round: number;
  matchNo: number;
  entry1: FixtureEntry;
  entry2: FixtureEntry | null; // null = 不戦（BYE）
  winner: FixtureEntry | null; // FINISHED で null = 引き分け
  score: string | null;
  status: MatchStatus;
}

let matchSeq = 0;
function match(
  round: number,
  entry1: FixtureEntry,
  entry2: FixtureEntry | null,
  winner: FixtureEntry | null,
  score: string | null,
  status: MatchStatus = "FINISHED",
  matchNo = 1,
): FixtureMatch {
  matchSeq += 1;
  return {
    id: `dt-m-${String(matchSeq).padStart(3, "0")}`,
    tournament: entry1.tournament,
    round,
    matchNo,
    entry1,
    entry2,
    winner,
    score,
    status,
  };
}

// 大会の開催日順・ラウンド順に並べる（直近試合の並び順は開催日→登録順で決まるため）。
export const FIXTURE_MATCHES: readonly FixtureMatch[] = [
  // t01: 太郎 2勝1敗
  match(1, E.t01Taro, E.t01Same, E.t01Taro, "6-3"),
  match(1, E.t01B, E.t01A, E.t01A, "2-6", "FINISHED", 2),
  match(2, E.t01Taro, E.t01B, E.t01Taro, "6-4"),
  match(3, E.t01A, E.t01Taro, E.t01A, "6-4"),
  // t02: 太郎 1勝1敗（不戦・引き分けは勝敗集計に含めない）
  match(1, E.t02Taro, E.t02Hanako, E.t02Taro, "6-2"),
  match(2, E.t02Taro, null, E.t02Taro, null),
  match(3, E.t02Taro, E.t02Cd, null, "3-3"),
  match(4, E.t02Same, E.t02Taro, E.t02Same, "6-4"),
  // t03: 太郎 1勝1敗
  match(1, E.t03Taro, E.t03Smash, E.t03Taro, "2-1"),
  match(2, E.t03Smash, E.t03Taro, E.t03Smash, "2-0"),
  // t04: 太郎 0勝1敗
  match(1, E.t04Taro, E.t04Same, E.t04Same, "3-6"),
  match(1, E.t04B, E.t04Same, E.t04B, "6-1", "FINISHED", 2),
  // t05: 太郎 2勝0敗（優勝）
  match(1, E.t05Taro, E.t05Mix, E.t05Taro, "2-1"),
  match(2, E.t05Taro, E.t05NoTeam, E.t05Taro, "2-0"),
  // t06: 太郎 1勝1敗
  match(1, E.t06Taro, E.t06B, E.t06Taro, "6-4"),
  match(2, E.t06A, E.t06Taro, E.t06A, "6-2"),
  // t07: 太郎は不参加
  match(1, E.t07Hanako, E.t07Cd, E.t07Hanako, "6-1"),
  match(2, E.t07Ab, E.t07Hanako, E.t07Hanako, "4-6"),
  // t08: 太郎 1勝0敗（優勝）
  match(1, E.t08Taro, E.t08Smash, E.t08Taro, "2-1"),
  // t09: 1試合は確定、もう1試合は未消化（結果未確定の大会）
  match(1, E.t09Taro, E.t09B, E.t09Taro, "6-1"),
  match(2, E.t09Taro, E.t09Same, null, null, "READY"),
];

// ---- GRANレベル変動（大会結果） ----
// 各ユーザーの現在レベル（users.gran_level）から逆算して、変動前／変動後が連続するように作る。
interface FixtureResultSpec {
  user: FixtureUser;
  tournament: FixtureTournament;
  rank: RankType;
  points: number | null;
  diff: number;
}

const RESULT_SPECS: readonly FixtureResultSpec[] = [
  // テスト太郎（7件。t09 は結果未確定のため無し）
  { user: U.taro, tournament: T.t01, rank: "T1_RUNNER_UP", points: 20, diff: 15 },
  { user: U.taro, tournament: T.t02, rank: "PARTICIPATED", points: 5, diff: -6 },
  { user: U.taro, tournament: T.t03, rank: "L2_WINNER", points: 10, diff: 0 },
  { user: U.taro, tournament: T.t04, rank: "PARTICIPATED", points: 5, diff: -9 },
  { user: U.taro, tournament: T.t05, rank: "T1_WINNER", points: 30, diff: 12 },
  { user: U.taro, tournament: T.t06, rank: "PARTICIPATED", points: 5, diff: 4 },
  { user: U.taro, tournament: T.t08, rank: "T1_WINNER", points: 30, diff: 8 },
  // その他のユーザー
  { user: U.hanako, tournament: T.t02, rank: "PARTICIPATED", points: 5, diff: -3 },
  { user: U.hanako, tournament: T.t05, rank: "T1_RUNNER_UP", points: 20, diff: 5 },
  { user: U.hanako, tournament: T.t07, rank: "T1_WINNER", points: 30, diff: 10 },
  { user: U.aClass, tournament: T.t01, rank: "T1_WINNER", points: 30, diff: 6 },
  { user: U.aClass, tournament: T.t03, rank: "T1_WINNER", points: 30, diff: 3 },
  { user: U.bClass, tournament: T.t01, rank: "PARTICIPATED", points: 5, diff: -4 },
  { user: U.bClass, tournament: T.t04, rank: "T1_WINNER", points: 30, diff: 6 },
  { user: U.sameLevel, tournament: T.t01, rank: "PARTICIPATED", points: 5, diff: -5 },
  { user: U.sameLevel, tournament: T.t04, rank: "T1_RUNNER_UP", points: 20, diff: 7 },
];

export interface FixtureResult {
  id: string;
  userId: string;
  tournamentId: string;
  teamId: string | null;
  rank: RankType;
  points: number | null;
  pre: number;
  diff: number;
  post: number;
  recordedAt: string;
}

function buildResults(): FixtureResult[] {
  const out: FixtureResult[] = [];
  for (const u of FIXTURE_USER_LIST) {
    const specs = RESULT_SPECS.filter((r) => r.user.id === u.id).sort((a, b) =>
      a.tournament.eventDate < b.tournament.eventDate ? -1 : 1,
    );
    // 新しい順にたどって、最新の変動後 = 現在レベルになるよう逆算する
    let post = u.granLevel;
    const chain: FixtureResult[] = [];
    for (const s of [...specs].reverse()) {
      const pre = post - s.diff;
      const myEntry = Object.values(FIXTURE_ENTRIES).find(
        (e) =>
          e.tournament.id === s.tournament.id &&
          e.members.some((m) => typeof m === "object" && "id" in m && m.id === u.id),
      );
      chain.push({
        id: `dt-r-${u.loginId}-${s.tournament.id}`,
        userId: u.id,
        tournamentId: s.tournament.id,
        teamId: s.tournament.category.endsWith("_TEAM") ? (myEntry?.teamId ?? null) : null,
        rank: s.rank,
        points: s.points,
        pre,
        diff: s.diff,
        post,
        recordedAt: `${s.tournament.eventDate} 18:00:00`,
      });
      post = pre;
    }
    out.push(...chain.reverse());
  }
  return out;
}

export const FIXTURE_RESULTS: readonly FixtureResult[] = buildResults();

// ---- 投入 ----

export interface SeedDataTabFixtureOptions {
  /** users.password_hash に入れる値。単体テストではダミー文字列でよい。 */
  passwordHash: string;
}

export interface SeedDataTabFixtureSummary {
  skipped: boolean;
  users: number;
  teams: number;
  tournaments: number;
  entries: number;
  matches: number;
  results: number;
}

const NOW = "datetime('now', '+9 hours')";

/**
 * データタブ確認用のフィクスチャを投入する。
 * 1件目のテストアカウント（login_id 920001）が既にあれば何もしない（冪等）。
 * 途中で失敗した場合はすべてロールバックする。
 */
export function seedDataTabFixture(
  db: DatabaseSync,
  opts: SeedDataTabFixtureOptions,
): SeedDataTabFixtureSummary {
  const exists = db
    .prepare("SELECT 1 AS x FROM users WHERE login_id = ?")
    .get(FIXTURE_USERS.taro.loginId);
  const entries = Object.values(FIXTURE_ENTRIES);
  const summary: SeedDataTabFixtureSummary = {
    skipped: false,
    users: FIXTURE_USER_LIST.length,
    teams: Object.keys(FIXTURE_TEAMS).length,
    tournaments: FIXTURE_TOURNAMENT_LIST.length,
    entries: entries.length,
    matches: FIXTURE_MATCHES.length,
    results: FIXTURE_RESULTS.length,
  };
  if (exists) return { ...summary, skipped: true };

  db.exec("BEGIN");
  try {
    const insUser = db.prepare(
      `INSERT INTO users (
         id, login_id, email, password_hash, role, is_admin, status, is_initial_login,
         real_name, kana_name, nickname, gender, birth_date, phone_number, declared_class,
         gran_level, is_level_calibrated, rated_match_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 0, 'ACTIVE', 0, ?, ?, ?, ?, '1995-04-01', '09000000000', ?,
         ?, ?, ?, ${NOW}, ${NOW})`,
    );
    const leaderIds = new Set(Object.values(FIXTURE_TEAMS).map((t) => t.leader.id));
    for (const u of FIXTURE_USER_LIST) {
      insUser.run(
        u.id,
        u.loginId,
        u.email,
        opts.passwordHash,
        leaderIds.has(u.id) ? "LEADER" : "USER",
        u.realName,
        u.kanaName,
        u.nickname,
        u.gender,
        u.declaredClass,
        u.granLevel,
        u.calibrated ? 1 : 0,
        u.ratedMatchCount,
      );
    }

    const insTeam = db.prepare(
      `INSERT INTO teams (id, name, leader_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ${NOW}, ${NOW})`,
    );
    const insTeamMember = db.prepare(
      `INSERT INTO team_members (id, team_id, user_id, joined_at) VALUES (?, ?, ?, ${NOW})`,
    );
    for (const team of Object.values(FIXTURE_TEAMS)) {
      insTeam.run(team.id, team.name, team.leader.id);
      team.members.forEach((m, i) => {
        insTeamMember.run(`${team.id}-m${i + 1}`, team.id, m.id);
      });
    }

    const insSeries = db.prepare("INSERT INTO tournament_series (id, name) VALUES (?, ?)");
    for (const s of Object.values(FIXTURE_SERIES)) insSeries.run(s.id, s.name);

    const insTournament = db.prepare(
      `INSERT INTO tournaments (
         id, title, category, tier, event_date, start_time, end_time, venue, court_info,
         image_url, description, capacity, team_size_min, team_size_max, entry_fee, status,
         entry_start_at, entry_end_at, alert_threshold, surface, series_id, gender_division,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, '09:00', '17:00', ?, NULL, NULL, ?, 16, NULL, NULL, 4000,
         'FINISHED', ?, ?, NULL, ?, ?, ?, ${NOW}, ${NOW})`,
    );
    for (const t of FIXTURE_TOURNAMENT_LIST) {
      insTournament.run(
        t.id,
        t.title,
        t.category,
        t.tier,
        t.eventDate,
        t.venue,
        "データタブ動作確認用のテスト大会です。",
        `${t.eventDate.slice(0, 4)}-01-01 00:00:00`,
        `${t.eventDate} 00:00:00`,
        t.surface,
        t.seriesId,
        t.division,
      );
    }

    const insEntry = db.prepare(
      `INSERT INTO entries (
         id, tournament_id, user_id, team_id, category, status, is_proxy,
         applied_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ${NOW}, ${NOW}, ${NOW})`,
    );
    const insMember = db.prepare(
      `INSERT INTO entry_members (
         id, entry_id, member_type, user_id, guest_name, is_pending, order_no,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW}, ${NOW})`,
    );
    for (const e of entries) {
      insEntry.run(e.id, e.tournament.id, e.applicant.id, e.teamId, e.tournament.category, e.status);
      e.members.forEach((m, i) => {
        const memberId = `${e.id}-m${i + 1}`;
        if (m === "PENDING") {
          insMember.run(memberId, e.id, "PENDING", null, null, 1, i + 1);
        } else if ("guest" in m) {
          insMember.run(memberId, e.id, "GUEST", null, m.guest, 0, i + 1);
        } else {
          insMember.run(memberId, e.id, "REGISTERED", m.id, null, 0, i + 1);
        }
      });
    }

    const insMatch = db.prepare(
      `INSERT INTO tournament_matches (
         id, tournament_id, round_number, match_number, court_name, entry1_id, entry2_id,
         winner_entry_id, score_detail, match_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW}, ${NOW})`,
    );
    for (const m of FIXTURE_MATCHES) {
      insMatch.run(
        m.id,
        m.tournament.id,
        m.round,
        m.matchNo,
        `コート${m.matchNo}`,
        m.entry1.id,
        m.entry2?.id ?? null,
        m.winner?.id ?? null,
        m.score,
        m.status,
      );
    }

    const insResult = db.prepare(
      `INSERT INTO tournament_results (
         id, tournament_id, team_id, user_id, rank_type, awarded_points,
         pre_gran_level, gran_level_diff, post_gran_level, recorded_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of FIXTURE_RESULTS) {
      insResult.run(r.id, r.tournamentId, r.teamId, r.userId, r.rank, r.points, r.pre, r.diff, r.post, r.recordedAt);
    }

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return summary;
}