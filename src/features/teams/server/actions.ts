"use server";
// チームページの Server Actions（参加リクエスト / 取り下げ / 承認・却下 / 脱退）。
// セッション検証を冒頭で行い、入力は Zod で検証する。権限判定はリポジトリ側で行う。
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  cancelJoinRequest,
  createJoinRequest,
  leaveTeam,
  resolveJoinRequest,
  type JoinResult,
} from "@/features/teams/server/teamPageRepository";

export interface TeamActionResult {
  ok: boolean;
  message?: string;
}

const idSchema = z.string().min(1).max(100);

const MESSAGES: Record<Extract<JoinResult, { ok: false }>["reason"], string> = {
  NOT_FOUND: "対象が見つかりません。",
  ALREADY_MEMBER: "すでにチームに所属しています。",
  ALREADY_PENDING: "このチームには申請済みです。",
  FORBIDDEN: "この操作の権限がありません。",
  NOT_PENDING: "このリクエストは処理済みです。",
  IS_LEADER: "代表者は脱退できません。",
};

function toResult(r: JoinResult): TeamActionResult {
  return r.ok ? { ok: true } : { ok: false, message: MESSAGES[r.reason] };
}

function refresh(teamId?: string) {
  revalidatePath("/team");
  if (teamId) revalidatePath(`/team/${teamId}`);
}

export async function requestJoinAction(teamId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(teamId);
  if (!id.success) return { ok: false, message: "入力が不正です。" };
  const r = createJoinRequest(id.data, session.sub);
  refresh(id.data);
  return toResult(r);
}

export async function cancelJoinRequestAction(teamId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(teamId);
  if (!id.success) return { ok: false, message: "入力が不正です。" };
  const r = cancelJoinRequest(id.data, session.sub);
  refresh(id.data);
  return toResult(r);
}

export async function resolveJoinRequestAction(
  requestId: unknown,
  approve: unknown,
): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(requestId);
  const flag = z.boolean().safeParse(approve);
  if (!id.success || !flag.success) return { ok: false, message: "入力が不正です。" };
  const r = resolveJoinRequest(id.data, session.sub, flag.data);
  refresh();
  revalidatePath("/team", "layout");
  return toResult(r);
}

export async function leaveTeamAction(teamId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(teamId);
  if (!id.success) return { ok: false, message: "入力が不正です。" };
  const r = leaveTeam(id.data, session.sub);
  refresh(id.data);
  return toResult(r);
}
