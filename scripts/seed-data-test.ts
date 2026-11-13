// データタブ動作確認用のテストアカウント（10件）とダミーデータを開発DBへ投入する。
//
// 実行:
//   npm run seed:data-test
//   （内部で `node --experimental-strip-types scripts/seed-data-test.ts` を実行）
//
// 投入先: data/gran.db（環境変数 GRAN_DB_PATH で変更可）
// 冪等性: テストアカウント 920001 が既にあれば何もしない。
// 内容: src/test/fixtures/dataTabFixture.ts（単体テストと同じデータ）
//
// ログイン: login_id 920001〜920010 / メール datatest01〜10@example.test、パスワードは password123

import bcrypt from "bcryptjs";
import { db } from "../src/lib/db.ts";
import {
  FIXTURE_USER_LIST,
  TEST_PASSWORD,
  seedDataTabFixture,
} from "../src/test/fixtures/dataTabFixture.ts";

async function main(): Promise<void> {
  console.log("[seed:data-test] 開始");
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const summary = seedDataTabFixture(db, { passwordHash });

  if (summary.skipped) {
    console.log("[seed:data-test] テストアカウントは既に存在します（スキップ）");
  } else {
    console.log(
      `[seed:data-test] 投入: ユーザー${summary.users}件 / チーム${summary.teams}件 / 大会${summary.tournaments}件 / エントリー${summary.entries}件 / 試合${summary.matches}件 / 大会結果${summary.results}件`,
    );
  }

  console.log("[seed:data-test] テストアカウント（パスワード共通: " + TEST_PASSWORD + "）");
  for (const u of FIXTURE_USER_LIST) {
    const state = u.calibrated ? `GRAN ${u.granLevel}` : "査定前";
    console.log(`  ${u.loginId}  ${u.email}  ${u.nickname}（${state}）`);
  }
  console.log("[seed:data-test] 完了");
}

main().catch((e) => {
  console.error("[seed:data-test] エラー:", e);
  process.exit(1);
});