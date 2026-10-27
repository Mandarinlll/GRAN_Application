// tournament_results テーブルに対する防御的データアクセスのガード。
//
// 本機能（データタブ）のレベル推移・出場履歴・成績サマリは
// `tournament_results` テーブルに依存するが、このテーブルは将来の正式実装まで
// 未整備（非存在）であり得る。未整備や実行時例外でアプリをクラッシュさせないため、
// 存在チェックと try/catch による安全実行ラッパをここに集約する
// （design.md「防御的データアクセス」/ Requirement 10.1〜10.4 / Property 13）。
//
// SQL の本体（履歴系 SELECT）は dataRepository.ts に閉じ込める方針だが、
// テーブル存在確認はクエリ安全化のための前提チェックであり、
// sqlite_master の参照に限定してここで行う。

import { db } from "@/lib/db";

// tournament_results テーブルが存在するか（sqlite_master を参照）。
// 存在確認そのものが例外を投げる可能性も考慮し、false にフォールバックする。
export function tournamentResultsTableExists(): boolean {
  try {
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tournament_results' LIMIT 1",
      )
      .get() as { name: string } | undefined;
    return row !== undefined;
  } catch {
    return false;
  }
}

// tournament_results 依存クエリを安全実行するためのラッパ。
// fn の実行が例外を投げた場合は fallback を返し、呼び出し側（および UI）を
// クラッシュさせない。非存在チェックと組み合わせて空配列 / ゼロ値へフォールバックする
// （design.md「防御的データアクセス」/ Requirement 10.1〜10.4 / Property 13）。
export function safeQuery<T>(fallback: T, fn: () => T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
