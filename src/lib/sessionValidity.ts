// セッション有効性の判定（純粋関数。DB に触れない）。

export interface SessionStateRow {
  status: string;
  session_version: number;
}

// 行が無い（削除済み）、停止中、版数不一致のいずれかなら無効。
export function evaluateSessionValidity(
  row: SessionStateRow | null | undefined,
  sv: number,
): boolean {
  if (!row) return false;
  if (row.status === "SUSPENDED") return false;
  return row.session_version === sv;
}
