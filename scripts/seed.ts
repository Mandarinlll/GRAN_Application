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

interface SeedTournament {
  title: string;
  category: Category;
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
        entry_start_at, entry_end_at, alert_threshold, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ${NOW_JST}, ${NOW_JST})`,
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

  console.log("[seed] 完了");
}

main().catch((e) => {
  console.error("[seed] エラー:", e);
  process.exit(1);
});
