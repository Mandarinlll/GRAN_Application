// アプリ全体で共有する SQLite データベースクライアント。
//
// 本来は docs のとおり Supabase(PostgreSQL) を採用する想定だが、
// この環境ではネイティブビルド(better-sqlite3)が使えないため、
// Node.js 24 標準搭載の `node:sqlite` を用いてローカルファイルに永続化する。
// これにより「新規登録した情報がDBに保存される」実務要件を追加依存なしで満たす。
//
// スキーマは docs/db-schema.md の各テーブル定義
// （users + teams/team_members/tournaments/entries/entry_members/
//   waitlists/cancellations/notification_logs）に準拠。
// （+ requirements-detail-user.md 1.4 のアカウントロック用カラム）

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// DB ファイルの保存先。プロジェクト直下の data/gran.db に置く。
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "gran.db");

// 現在日時を日本標準時（JST, UTC+9）で返す SQLite の式。
// SQLite の datetime('now') は UTC を返すため、+9時間して JST に補正する。
// 本アプリは日本国内の大会運営専用であり、保存値をそのまま日本時間として扱う。
// （将来 Supabase(PostgreSQL, TIMESTAMPTZ) へ移行する際は UTC 保存へ見直す）
export const NOW_JST = "datetime('now', '+9 hours')";

// Next.js の dev では module が複数回評価されうるため、
// グローバルに一度だけ生成したインスタンスを使い回す（コネクション多重生成の防止）。
declare global {
  // eslint-disable-next-line no-var
  var __granDb: DatabaseSync | undefined;
}

function createDatabase(): DatabaseSync {
  // data ディレクトリが無ければ作成する。
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);

  // 外部キー制約を有効化し、書き込み耐性の高い WAL モードにする。
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");

  // users テーブル（db-schema.md 3.1 準拠）。
  // ENUM は SQLite に無いため CHECK 制約で表現する。
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                    TEXT    PRIMARY KEY,
      login_id              TEXT    NOT NULL UNIQUE,
      email                 TEXT    NOT NULL UNIQUE,
      password_hash         TEXT    NOT NULL,
      role                  TEXT    NOT NULL DEFAULT 'USER'
                              CHECK (role IN ('ADMIN','OPERATOR','LEADER','USER')),
      is_admin              INTEGER NOT NULL DEFAULT 0,
      status                TEXT    NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE','SUSPENDED','PROVISIONAL')),
      is_initial_login      INTEGER NOT NULL DEFAULT 0,
      real_name             TEXT    NOT NULL,
      kana_name             TEXT    NOT NULL,
      nickname              TEXT    NOT NULL,
      avatar_url            TEXT,
      gender                TEXT    CHECK (gender IN ('MALE','FEMALE','OTHER')),
      birth_date            TEXT,
      phone_number          TEXT,
      declared_class        TEXT    CHECK (declared_class IN ('A','AB','B','BC','C','CD','D','DE')),
      gran_level            INTEGER NOT NULL DEFAULT 100
                              CHECK (gran_level BETWEEN 100 AND 999),
      is_level_calibrated   INTEGER NOT NULL DEFAULT 0,
      rated_match_count     INTEGER NOT NULL DEFAULT 0,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until          TEXT,
      last_login_at         TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // 検索用インデックス（db-schema.md 4 準拠の一部）。
  db.exec("CREATE INDEX IF NOT EXISTS idx_users_gran_level ON users(gran_level DESC);");

  // ------------------------------------------------------------------
  // チーム・大会・エントリー系テーブル（db-schema.md 3.2〜3.12 準拠）。
  // ENUM は SQLite に無いため CHECK 制約で表現する。
  // 日時は users テーブル同様 JST 保存（アプリ側で NOW_JST を明示書き込み）。
  // ------------------------------------------------------------------

  // teams（チーム基本情報 / db-schema.md 3.2）。
  // leader_user_id は UNIQUE 制約で「1ユーザー1代表」をDB保証する。
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      avatar_url     TEXT,
      leader_user_id TEXT NOT NULL UNIQUE
                       REFERENCES users(id) ON DELETE CASCADE,
      created_at     TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // team_members（チーム所属メンバー構成 / db-schema.md 3.3）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id        TEXT PRIMARY KEY,
      team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
      UNIQUE (team_id, user_id)
    );
  `);

  // tournaments（大会要項・管理情報 / db-schema.md 3.4）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id              TEXT    PRIMARY KEY,
      title           TEXT    NOT NULL,
      category        TEXT    NOT NULL
                        CHECK (category IN ('MEN_TEAM','WOMEN_TEAM','MIX_TEAM','SINGLES','DOUBLES')),
      tier            TEXT    NOT NULL
                        CHECK (tier IN ('A','AB','B','BC','C','CD','D','DE')),
      event_date      TEXT    NOT NULL,
      start_time      TEXT    NOT NULL,
      end_time        TEXT,
      venue           TEXT    NOT NULL,
      court_info      TEXT,
      image_url       TEXT,
      description     TEXT,
      capacity        INTEGER NOT NULL,
      team_size_min   INTEGER,
      team_size_max   INTEGER,
      entry_fee       INTEGER NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','UPCOMING','OPEN','CLOSED','FINISHED','CANCELLED')),
      entry_start_at  TEXT    NOT NULL,
      entry_end_at    TEXT    NOT NULL,
      copy_from_id    TEXT    REFERENCES tournaments(id),
      alert_threshold INTEGER,
      draw_pdf_url    TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // entries（大会エントリー基本情報 / db-schema.md 3.5）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id            TEXT    PRIMARY KEY,
      tournament_id TEXT    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id       TEXT    NOT NULL REFERENCES users(id),
      team_id       TEXT    REFERENCES teams(id),
      category      TEXT    NOT NULL
                      CHECK (category IN ('MEN_TEAM','WOMEN_TEAM','MIX_TEAM','SINGLES','DOUBLES')),
      status        TEXT    NOT NULL DEFAULT 'CONFIRMED'
                      CHECK (status IN ('CONFIRMED','WAITING','CANCELLED','ATTENDED')),
      is_proxy      INTEGER NOT NULL DEFAULT 0,
      applied_at    TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // entry_members（エントリー参加メンバー構成 / db-schema.md 3.6）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry_members (
      id          TEXT    PRIMARY KEY,
      entry_id    TEXT    NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      member_type TEXT    NOT NULL
                    CHECK (member_type IN ('REGISTERED','GUEST','PENDING')),
      user_id     TEXT    REFERENCES users(id),
      guest_name  TEXT,
      is_pending  INTEGER NOT NULL DEFAULT 0,
      order_no    INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // waitlists（キャンセル待ちキュー管理 / db-schema.md 3.7）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlists (
      id              TEXT    PRIMARY KEY,
      tournament_id   TEXT    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      user_id         TEXT    NOT NULL REFERENCES users(id),
      team_id         TEXT    REFERENCES teams(id),
      queue_number    INTEGER NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'WAITING'
                        CHECK (status IN ('WAITING','OFFERED','ACCEPTED','DECLINED','EXPIRED')),
      offered_at      TEXT,
      accept_deadline TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // cancellations（キャンセル・精算管理 / db-schema.md 3.8）。
  // entry_id は UNIQUE 制約で「1エントリー1キャンセル」を保証する。
  db.exec(`
    CREATE TABLE IF NOT EXISTS cancellations (
      id           TEXT    PRIMARY KEY,
      entry_id     TEXT    NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
      cancelled_at TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      days_before  INTEGER NOT NULL,
      fee_rate     INTEGER NOT NULL CHECK (fee_rate IN (0, 50, 100)),
      fee_amount   INTEGER NOT NULL,
      is_paid      INTEGER NOT NULL DEFAULT 0,
      admin_status TEXT    NOT NULL DEFAULT 'NOT_REQUIRED'
                     CHECK (admin_status IN ('NOT_REQUIRED','UNCONTACTED','IN_CONSULTATION','PAID_CONFIRMED','WAIVED')),
      admin_notes  TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // notification_logs（通知・配信ログ / db-schema.md 3.12）。
  // 本実装では通知の実送信は行わず、このログへの記録のみ（スタブ）とする。
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id              TEXT PRIMARY KEY,
      delivery_type   TEXT NOT NULL
                        CHECK (delivery_type IN (
                          'ENTRY_CONFIRMED','CANCEL_FREE','CANCEL_PAID_USER','CANCEL_PAID_ADMIN',
                          'WAITLIST_OFFER','REMINDER_10DAYS','CAPACITY_ALERT','URGENT_BROADCAST'
                        )),
      user_id         TEXT REFERENCES users(id),
      recipient_email TEXT,
      tournament_id   TEXT REFERENCES tournaments(id),
      entry_id        TEXT REFERENCES entries(id),
      message_payload TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'SUCCESS'
                        CHECK (status IN ('SUCCESS','FAILED')),
      error_message   TEXT,
      sent_at         TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
    );
  `);

  // インデックス（db-schema.md 4 準拠）。
  db.exec("CREATE INDEX IF NOT EXISTS idx_tournaments_date_status ON tournaments(event_date ASC, status);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_tournament_status ON entries(tournament_id, status);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id, applied_at DESC);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entry_members_pending ON entry_members(is_pending) WHERE is_pending = 1;");
  db.exec("CREATE INDEX IF NOT EXISTS idx_waitlists_queue ON waitlists(tournament_id, status, queue_number ASC);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cancellations_admin_alert ON cancellations(admin_status) WHERE is_paid = 1 AND admin_status IN ('UNCONTACTED', 'IN_CONSULTATION');");

  return db;
}

// 既存インスタンスがあれば再利用、無ければ生成する。
export const db: DatabaseSync = globalThis.__granDb ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalThis.__granDb = db;
}
