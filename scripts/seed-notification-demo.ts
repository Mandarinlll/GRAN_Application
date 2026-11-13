// 通知ページ動作確認用のデモデータ投入スクリプト。
//
// 実行:
//   npm run seed:notification-demo [-- <ログインID>]
//   （ログインID省略時は 000101）
//
// 投入内容（対象ユーザーの確定エントリー。開催日は「実行日」基準の相対日付）:
//   A) シングルス  : 開催7日後  → リマインドが今すぐ表示される（7日前 9:00 を過ぎているため）
//   B) ダブルス    : 開催14日後 → 未定枠1名 → 「メンバー指定」通知。リマインドは7日後に表示
//   C) 団体戦      : 開催30日後 → 未定枠2名 + ゲスト1名 → 「メンバー指定」通知（ゲストは対象外の確認用）
//
// 冪等性: デモ用の大会ID（demo-notif-*）が既にあれば再作成しない。
//   やり直したい場合は、先にデモ大会を削除してから再実行する（entries 等は CASCADE で消える）:
//     DELETE FROM tournaments WHERE id LIKE 'demo-notif-%';
import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "../src/lib/db.ts";

const loginId = process.argv[2] ?? "000101";

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const user = db
  .prepare("SELECT id, real_name FROM users WHERE login_id = ?")
  .get(loginId) as { id: string; real_name: string } | undefined;
if (!user) {
  console.error(`ログインID ${loginId} のユーザーが見つかりません。`);
  process.exit(1);
}

// 対象ユーザーが代表のチームと、そのメンバー（団体戦のデモ用）。
const team = db
  .prepare("SELECT id, name FROM teams WHERE leader_user_id = ?")
  .get(user.id) as { id: string; name: string } | undefined;
const teammates = team
  ? (db
      .prepare(
        "SELECT user_id FROM team_members WHERE team_id = ? AND user_id != ? LIMIT 2",
      )
      .all(team.id, user.id) as Array<{ user_id: string }>)
  : [];

type MemberSeed =
  | { type: "REGISTERED"; userId: string }
  | { type: "GUEST"; name: string }
  | { type: "PENDING" };

interface DemoSeed {
  id: string;
  title: string;
  category: "SINGLES" | "DOUBLES" | "MEN_TEAM";
  tier: string;
  offsetDays: number;
  capacity: number;
  size: [number, number] | null;
  useTeam: boolean;
  members: MemberSeed[];
}

const seeds: DemoSeed[] = [
  {
    id: "demo-notif-a",
    title: "【通知デモ】シングルス（7日後・リマインド表示）",
    category: "SINGLES",
    tier: "C",
    offsetDays: 7,
    capacity: 32,
    size: null,
    useTeam: false,
    members: [{ type: "REGISTERED", userId: user.id }],
  },
  {
    id: "demo-notif-b",
    title: "【通知デモ】ダブルス（14日後・未定枠1名）",
    category: "DOUBLES",
    tier: "C",
    offsetDays: 14,
    capacity: 16,
    size: null,
    useTeam: false,
    members: [{ type: "REGISTERED", userId: user.id }, { type: "PENDING" }],
  },
  {
    id: "demo-notif-c",
    title: "【通知デモ】男子団体戦（30日後・未定枠2名+ゲスト1名）",
    category: "MEN_TEAM",
    tier: "C",
    offsetDays: 30,
    capacity: 8,
    size: [6, 6],
    useTeam: team !== undefined,
    members: [
      { type: "REGISTERED", userId: user.id },
      ...teammates.map((t): MemberSeed => ({ type: "REGISTERED", userId: t.user_id })),
      { type: "GUEST", name: "ゲスト 参加者" },
      { type: "PENDING" },
      { type: "PENDING" },
    ].slice(0, 6) as MemberSeed[],
  },
];

for (const s of seeds) {
  const exists = db.prepare("SELECT 1 FROM tournaments WHERE id = ?").get(s.id);
  if (exists) {
    console.log(`skip: ${s.id}（作成済み）`);
    continue;
  }
  const date = ymd(s.offsetDays);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO tournaments (
        id, title, category, tier, event_date, start_time, end_time, venue,
        capacity, team_size_min, team_size_max, entry_fee, status,
        entry_start_at, entry_end_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, '09:00', '17:00', '札幌テニスコート', ?, ?, ?, 3000,
        'OPEN', ?, ?, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      s.id,
      s.title,
      s.category,
      s.tier,
      date,
      s.capacity,
      s.size?.[0] ?? null,
      s.size?.[1] ?? null,
      `${ymd(-30)} 00:00:00`,
      `${ymd(s.offsetDays - 1)} 23:59:59`,
    );
    const entryId = `${s.id}-entry`;
    db.prepare(
      `INSERT INTO entries (
        id, tournament_id, user_id, team_id, category, status, is_proxy,
        applied_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'CONFIRMED', 0, ${NOW_JST}, ${NOW_JST}, ${NOW_JST})`,
    ).run(
      entryId,
      s.id,
      user.id,
      s.useTeam && team ? team.id : null,
      s.category,
    );
    const stmt = db.prepare(
      `INSERT INTO entry_members (
        id, entry_id, member_type, user_id, guest_name, is_pending, order_no,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW_JST}, ${NOW_JST})`,
    );
    s.members.forEach((m, i) => {
      stmt.run(
        randomUUID(),
        entryId,
        m.type,
        m.type === "REGISTERED" ? m.userId : null,
        m.type === "GUEST" ? m.name : null,
        m.type === "PENDING" ? 1 : 0,
        i + 1,
      );
    });
    db.exec("COMMIT");
    console.log(`created: ${s.title}（${date}）`);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
console.log(`完了。${user.real_name}（${loginId}）で /notifications を開いてください。`);
