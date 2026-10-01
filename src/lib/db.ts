// アプリ全体で共有する SQLite データベースクライアント。
//
// 本来は docs のとおり Supabase(PostgreSQL) を採用する想定だが、
// この環境ではネイティブビルド(better-sqlite3)が使えないため、
// Node.js 24 標準搭載の `node:sqlite` を用いてローカルファイルに永続化する。
// これにより「新規登録した情報がDBに保存される」実務要件を追加依存なしで満たす。
//
// スキーマは docs/db-schema.md の users テーブル定義
// （+ requirements-detail-user.md 1.4 のアカウントロック用カラム）に準拠。

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

  return db;
}

// 既存インスタンスがあれば再利用、無ければ生成する。
export const db: DatabaseSync = globalThis.__granDb ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalThis.__granDb = db;
}
