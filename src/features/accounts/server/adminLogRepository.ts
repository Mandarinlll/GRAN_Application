// 管理者操作ログ（admin_account_logs）の INSERT / SELECT。SQL はすべてバインド変数。
// トランザクション境界は呼び出し側（サービス）が持つ。

import { randomUUID } from "node:crypto";
import { db, NOW_JST } from "@/lib/db";
import type { AdminLogRow } from "@/features/accounts/types/account";
import { buildLogDetail } from "@/features/accounts/utils/logDetail";

export type AdminLogTargetType = "USER" | "TEAM";

export const LOG_LIST_LIMIT = 20;

export interface InsertLogInput {
  action: string;
  targetType: AdminLogTargetType;
  targetId: string;
  operatorUserId: string;
  /** 固定の形のフィールド。省略時は detail = NULL。 */
  detail?: Record<string, string | number | boolean | null>;
}

// created_at は NOW_JST を明示して書く（DEFAULT なし）。
export function insertLog(input: InsertLogInput): string {
  const id = randomUUID();
  const detail = input.detail ? buildLogDetail(input.detail) : null;
  db.prepare(
    `INSERT INTO admin_account_logs (id, action, target_type, target_id, operator_user_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ${NOW_JST})`,
  ).run(id, input.action, input.targetType, input.targetId, input.operatorUserId, detail);
  return id;
}

// 対象の最新ログを新しい順に最大 20 件返す。
export function listLogsForTarget(
  targetType: AdminLogTargetType,
  targetId: string,
): AdminLogRow[] {
  const rows = db
    .prepare(
      `SELECT l.id, l.action, u.login_id AS operator_login_id, l.detail, l.created_at
         FROM admin_account_logs l
         JOIN users u ON u.id = l.operator_user_id
        WHERE l.target_type = ? AND l.target_id = ?
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT ?`,
    )
    .all(targetType, targetId, LOG_LIST_LIMIT) as {
    id: string;
    action: string;
    operator_login_id: string;
    detail: string | null;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    operatorLoginId: r.operator_login_id,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
