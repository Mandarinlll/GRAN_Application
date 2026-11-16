"use server";
// チームページの Server Actions（脱退 / 作成・編集・解散 / 除名 / 招待）。
// セッション検証を冒頭で行い、入力は Zod で検証する。権限判定はリポジトリ側で行う。
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  cancelInvitation,
  createTeamAsLeader,
  deleteTeamAsLeader,
  inviteUser,
  leaveTeam,
  removeMember,
  renameTeam,
  respondToInvitation,
  searchInviteCandidates,
  type InviteResult,
  type JoinResult,
  type TeamMutationResult,
} from "@/features/teams/server/teamPageRepository";
import type { InviteCandidate } from "@/features/teams/types/team";
import { imageStorage } from "@/features/teams/server/imageStorage";

export interface TeamActionResult {
  ok: boolean;
  message?: string;
}

const idSchema = z.string().min(1).max(100);

const MESSAGES: Record<Extract<JoinResult, { ok: false }>["reason"], string> = {
  NOT_FOUND: "対象が見つかりません。",
  NOT_MEMBER: "対象のメンバーがこのチームにいません。",
  FORBIDDEN: "この操作の権限がありません。",
  IS_LEADER: "代表者は脱退できません。",
};

function toResult(r: JoinResult): TeamActionResult {
  return r.ok ? { ok: true } : { ok: false, message: MESSAGES[r.reason] };
}

function refresh(teamId?: string) {
  revalidatePath("/team");
  if (teamId) revalidatePath(`/team/${teamId}`);
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

// --- チームの作成・編集・削除 ---

const teamNameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "チーム名を入力してください。").max(15, "チーム名は15文字以内で入力してください。"));

const MUTATION_MESSAGES: Record<Extract<TeamMutationResult, { ok: false }>["reason"], string> = {
  ALREADY_LEADER: "すでに代表を務めるチームがあります。",
  NAME_TAKEN: "同じ名前のチームがすでに存在します。",
  NOT_FOUND: "チームが見つかりません。",
  FORBIDDEN: "代表者のみ操作できます。",
};

interface TeamMutationActionResult extends TeamActionResult {
  teamId?: string;
}

export async function createTeamAction(name: unknown): Promise<TeamMutationActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const parsed = teamNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  const r = createTeamAsLeader(session.sub, parsed.data);
  if (!r.ok) return { ok: false, message: MUTATION_MESSAGES[r.reason] };
  revalidatePath("/team");
  return { ok: true, teamId: r.teamId };
}

export async function renameTeamAction(teamId: unknown, name: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(teamId);
  const parsed = teamNameSchema.safeParse(name);
  if (!id.success) return { ok: false, message: "入力が不正です。" };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  const r = renameTeam(id.data, session.sub, parsed.data);
  if (!r.ok) return { ok: false, message: MUTATION_MESSAGES[r.reason] };
  refresh(id.data);
  return { ok: true };
}

export async function deleteTeamAction(teamId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(teamId);
  if (!id.success) return { ok: false, message: "入力が不正です。" };
  const r = deleteTeamAsLeader(id.data, session.sub);
  if (!r.ok) return { ok: false, message: MUTATION_MESSAGES[r.reason] };
  if (r.avatarKey) await imageStorage.delete(r.avatarKey);
  revalidatePath("/team", "layout");
  revalidatePath("/tournaments");
  return { ok: true };
}
export async function removeMemberAction(teamId: unknown, userId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const tid = idSchema.safeParse(teamId);
  const uid = idSchema.safeParse(userId);
  if (!tid.success || !uid.success) return { ok: false, message: "入力が不正です。" };
  const r = removeMember(tid.data, session.sub, uid.data);
  refresh(tid.data);
  revalidatePath(`/team/${tid.data}/edit`);
  return toResult(r);
}

// --- チーム招待 ---

const INVITE_MESSAGES: Record<Extract<InviteResult, { ok: false }>["reason"], string> = {
  NOT_FOUND: "対象が見つかりません。",
  FORBIDDEN: "代表者のみ操作できます。",
  ALREADY_MEMBER: "すでにこのチームに所属しています。",
  ALREADY_INVITED: "すでに招待済みです。",
  NOT_PENDING: "この招待はすでに処理されています。",
  SELF: "自分自身は招待できません。",
};

function toInviteResult(r: InviteResult): TeamActionResult & { teamId?: string } {
  return r.ok ? { ok: true, teamId: r.teamId } : { ok: false, message: INVITE_MESSAGES[r.reason] };
}

export async function searchInviteCandidatesAction(
  teamId: unknown,
  query: unknown,
): Promise<InviteCandidate[]> {
  const session = await getSession();
  if (!session) return [];
  const id = idSchema.safeParse(teamId);
  const q = z.string().max(40).safeParse(query);
  if (!id.success || !q.success) return [];
  return searchInviteCandidates(id.data, session.sub, q.data);
}

export async function inviteUserAction(teamId: unknown, userId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const tid = idSchema.safeParse(teamId);
  const uid = idSchema.safeParse(userId);
  if (!tid.success || !uid.success) return { ok: false, message: "入力が不正です。" };
  const r = inviteUser(tid.data, session.sub, uid.data);
  revalidatePath(`/team/${tid.data}/edit`);
  revalidatePath("/notifications");
  return toInviteResult(r);
}

export async function cancelInvitationAction(invitationId: unknown): Promise<TeamActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(invitationId);
  if (!id.success) return { ok: false, message: "入力が不正です。" };
  const r = cancelInvitation(id.data, session.sub);
  revalidatePath("/team", "layout");
  revalidatePath("/notifications");
  return toInviteResult(r);
}

// 招待された本人が通知ページから承諾/辞退する。承諾時は参加先の teamId を返す。
export async function respondInvitationAction(
  invitationId: unknown,
  accept: unknown,
): Promise<TeamActionResult & { teamId?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインしてください。" };
  const id = idSchema.safeParse(invitationId);
  const flag = z.boolean().safeParse(accept);
  if (!id.success || !flag.success) return { ok: false, message: "入力が不正です。" };
  const r = respondToInvitation(id.data, session.sub, flag.data);
  revalidatePath("/team", "layout");
  revalidatePath("/notifications");
  return toInviteResult(r);
}