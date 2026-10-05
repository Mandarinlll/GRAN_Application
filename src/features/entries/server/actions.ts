"use server";

// エントリー機能の Server Actions
// （単一申込 / 一括申込 / キャンセル待ち / キャンセル / メンバー更新）。
//
// 方針（コーディング規約 5〜7）:
//  - セッション検証と権限チェック（代表者判定）を冒頭で早期リターン。
//  - 入力は Zod で検証。
//  - 定員排他・ステータス整合はリポジトリ層のトランザクションに委譲。
//  - 通知は notification_logs への記録のみ（実送信はスタブ）。
//  - DB例外や内部詳細はクライアントへ返さず、汎用メッセージへマッピングする。

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { findUserById } from "@/features/auth/server/userRepository";
import {
  bulkEntryCreateSchema,
  cancelEntrySchema,
  entryCreateSchema,
  updateMembersSchema,
  waitlistCreateSchema,
} from "@/features/entries/types/schema";
import {
  cancelEntry,
  createConfirmedEntry,
  createWaitlist,
  findEntryById,
  findSameDayActiveEntries,
  listEntrySummaries,
  replaceEntryMembers,
} from "@/features/entries/server/entryRepository";
import type { EntrySummary } from "@/features/entries/types/entry";
import { findTournamentWithStats } from "@/features/tournaments/server/tournamentRepository";
import { findTeamById } from "@/features/teams/server/teamRepository";
import { logNotification } from "@/features/notifications/server/notificationRepository";
import { calculateCancelFee } from "@/features/entries/utils/cancelFee";
import {
  memberCountRange,
  requiresLeader,
  requiresTeam,
} from "@/features/tournaments/utils/category";
import type { EntryMemberInput } from "@/features/entries/types/schema";
import type { MemberType } from "@/features/entries/types/entry";

// Server Action 共通の結果型。
export interface EntryActionResult {
  ok: boolean;
  message?: string;
  // 同日重複時は confirm=true を返し、クライアント側で確認後に再送してもらう。
  needsConfirm?: boolean;
  conflictTournaments?: string[];
  // 成功時に返す参考情報（完了画面表示用）。
  entryId?: string;
  queueNumber?: number;
  // 一括時の個別結果。
  results?: Array<{ tournamentId: string; ok: boolean; message: string }>;
}

// Zod のメンバー入力 → リポジトリのメンバー形へ変換。
function toRepoMembers(members: EntryMemberInput[]) {
  return members.map((m) => ({
    memberType: m.memberType as MemberType,
    userId: m.memberType === "REGISTERED" ? (m.userId ?? null) : null,
    guestName: m.memberType === "GUEST" ? (m.guestName ?? null) : null,
    orderNo: m.orderNo,
  }));
}

// ---- 単一エントリー申込 ----
export async function submitEntryAction(
  input: unknown,
): Promise<EntryActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  const parsed = entryCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。",
    };
  }
  const data = parsed.data;

  const user = findUserById(session.sub);
  if (!user) return { ok: false, message: "ユーザーが見つかりません。" };

  const tournament = findTournamentWithStats(data.tournamentId);
  if (!tournament) return { ok: false, message: "大会が見つかりません。" };

  // 受付中以外は申込不可。
  if (tournament.status !== "OPEN") {
    return { ok: false, message: "この大会は現在エントリーを受け付けていません。" };
  }

  const category = tournament.category;

  // 代表者権限チェック（ダブルス・団体戦）。
  if (requiresLeader(category) && user.role !== "LEADER" && !user.isAdmin) {
    return {
      ok: false,
      message: "この種目は代表者のみ申込できます。チームの代表者にご依頼ください。",
    };
  }

  // チーム必須種目の teamId 検証。
  let teamId: string | null = null;
  if (requiresTeam(category)) {
    if (!data.teamId) {
      return { ok: false, message: "申込チームを指定してください。" };
    }
    const team = findTeamById(data.teamId);
    if (!team) return { ok: false, message: "チームが見つかりません。" };
    // 本人がそのチームの代表者か（管理者は代理可）。
    if (team.leaderUserId !== user.id && !user.isAdmin) {
      return { ok: false, message: "ご自身が代表を務めるチームでのみ申込できます。" };
    }
    teamId = team.id;
  }

  // メンバー構成の決定。シングルスは本人のみを自動補完。
  const range = memberCountRange(
    category,
    tournament.teamSizeMin,
    tournament.teamSizeMax,
  );
  let members = toRepoMembers(data.members);
  if (category === "SINGLES") {
    members = [
      { memberType: "REGISTERED", userId: user.id, guestName: null, orderNo: 1 },
    ];
  } else {
    // 人数レンジの検証（未定枠・ゲストを含む総数）。
    if (members.length < range.min || members.length > range.max) {
      return {
        ok: false,
        message: `出場メンバーは ${range.min}〜${range.max} 名で登録してください。`,
      };
    }
  }

  // 同日重複チェック（重複排除。承認（acknowledgeConflict）前なら確認を促す）。
  const conflicts = findSameDayActiveEntries(
    tournament.eventDate,
    user.id,
    teamId,
    tournament.id,
  );
  if (conflicts.length > 0 && !data.acknowledgeConflict) {
    return {
      ok: false,
      needsConfirm: true,
      conflictTournaments: conflicts,
      message:
        "同日に既にエントリー中の大会があります。重複参加にならないかご確認ください。",
    };
  }

  // 満員ならキャンセル待ちへ誘導（ここでは確定エントリーのみ作る）。
  if (tournament.remaining <= 0) {
    return {
      ok: false,
      message: "この大会は満員です。キャンセル待ちへご登録ください。",
    };
  }

  try {
    const result = createConfirmedEntry({
      tournamentId: tournament.id,
      userId: user.id,
      teamId,
      category,
      members,
    });

    if (!result.ok) {
      if (result.reason === "FULL") {
        return {
          ok: false,
          message: "直前に満員となりました。キャンセル待ちへご登録ください。",
        };
      }
      return { ok: false, message: "この大会には既にエントリー済みです。" };
    }

    // エントリー完了通知（スタブ記録）。
    logNotification({
      deliveryType: "ENTRY_CONFIRMED",
      userId: user.id,
      recipientEmail: user.email,
      tournamentId: tournament.id,
      entryId: result.entry.id,
      messagePayload: `エントリー完了: ${tournament.title}`,
    });

    revalidatePath("/tournaments");
    return { ok: true, entryId: result.entry.id, message: "エントリーが完了しました。" };
  } catch {
    return {
      ok: false,
      message: "エントリー処理でエラーが発生しました。時間をおいてお試しください。",
    };
  }
}

// ---- 一括エントリー申込 ----
export async function submitBulkEntryAction(
  input: unknown,
): Promise<EntryActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  const parsed = bulkEntryCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。",
    };
  }
  const data = parsed.data;

  // 各大会を順に処理する。1件ごとに単一申込ロジックを再利用する。
  const results: EntryActionResult["results"] = [];
  for (const tournamentId of data.tournamentIds) {
    const r = await submitEntryAction({
      tournamentId,
      teamId: data.teamId,
      members: data.members,
      acknowledgeConflict: data.acknowledgeConflict,
      agreeTerms: data.agreeTerms,
    });
    results.push({
      tournamentId,
      ok: r.ok,
      message: r.message ?? (r.ok ? "完了" : "失敗"),
    });
  }

  const okCount = results.filter((r) => r.ok).length;
  revalidatePath("/tournaments");
  return {
    ok: okCount > 0,
    message: `${results.length}件中 ${okCount}件のエントリーが完了しました。`,
    results,
  };
}

// ---- キャンセル待ち登録 ----
export async function submitWaitlistAction(
  input: unknown,
): Promise<EntryActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  const parsed = waitlistCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "入力内容をご確認ください。" };
  }
  const data = parsed.data;

  const user = findUserById(session.sub);
  if (!user) return { ok: false, message: "ユーザーが見つかりません。" };

  const tournament = findTournamentWithStats(data.tournamentId);
  if (!tournament) return { ok: false, message: "大会が見つかりません。" };

  const category = tournament.category;

  // 代表者権限・チーム検証（確定申込と同じルール）。
  let teamId: string | null = null;
  if (requiresTeam(category)) {
    if (requiresLeader(category) && user.role !== "LEADER" && !user.isAdmin) {
      return { ok: false, message: "この種目は代表者のみ申込できます。" };
    }
    if (!data.teamId) return { ok: false, message: "申込チームを指定してください。" };
    const team = findTeamById(data.teamId);
    if (!team) return { ok: false, message: "チームが見つかりません。" };
    if (team.leaderUserId !== user.id && !user.isAdmin) {
      return { ok: false, message: "ご自身が代表を務めるチームでのみ申込できます。" };
    }
    teamId = team.id;
  }

  try {
    const result = createWaitlist({
      tournamentId: tournament.id,
      userId: user.id,
      teamId,
    });
    if (!result.ok) {
      return { ok: false, message: "既にキャンセル待ちに登録済みです。" };
    }

    logNotification({
      deliveryType: "ENTRY_CONFIRMED",
      userId: user.id,
      recipientEmail: user.email,
      tournamentId: tournament.id,
      messagePayload: `キャンセル待ち登録: ${tournament.title}（順位 ${result.waitlist.queueNumber}）`,
    });

    revalidatePath("/tournaments");
    return {
      ok: true,
      queueNumber: result.waitlist.queueNumber,
      message: "キャンセル待ちに登録しました。",
    };
  } catch {
    return { ok: false, message: "処理でエラーが発生しました。" };
  }
}

// ---- キャンセル申請 ----
export async function cancelEntryAction(
  input: unknown,
): Promise<EntryActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  const parsed = cancelEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "入力内容をご確認ください。" };
  }

  const user = findUserById(session.sub);
  if (!user) return { ok: false, message: "ユーザーが見つかりません。" };

  const entry = findEntryById(parsed.data.entryId);
  if (!entry) return { ok: false, message: "エントリーが見つかりません。" };

  // 権限: 本人の個人エントリー、またはチームの代表者・管理者。
  let allowed = entry.userId === user.id;
  if (!allowed && entry.teamId) {
    const team = findTeamById(entry.teamId);
    allowed = team?.leaderUserId === user.id;
  }
  if (!allowed && user.isAdmin) allowed = true;
  if (!allowed) {
    return { ok: false, message: "このエントリーをキャンセルする権限がありません。" };
  }

  if (entry.status !== "CONFIRMED") {
    return { ok: false, message: "このエントリーはキャンセルできません。" };
  }

  const tournament = findTournamentWithStats(entry.tournamentId);
  if (!tournament) return { ok: false, message: "大会が見つかりません。" };

  const fee = calculateCancelFee(tournament.eventDate, tournament.entryFee);

  try {
    cancelEntry({
      entryId: entry.id,
      daysBefore: fee.daysBefore,
      feeRate: fee.feeRate,
      feeAmount: fee.feeAmount,
      isPaid: fee.isPaid,
      adminStatus: fee.adminStatus,
    });

    // キャンセル通知（無料/有償で種別を分ける。有償は管理者通知も記録）。
    logNotification({
      deliveryType: fee.isPaid ? "CANCEL_PAID_USER" : "CANCEL_FREE",
      userId: user.id,
      recipientEmail: user.email,
      tournamentId: tournament.id,
      entryId: entry.id,
      messagePayload: `キャンセル受付: ${tournament.title}（料率 ${fee.feeRate}% / ¥${fee.feeAmount}）`,
    });
    if (fee.isPaid) {
      logNotification({
        deliveryType: "CANCEL_PAID_ADMIN",
        tournamentId: tournament.id,
        entryId: entry.id,
        messagePayload: `有償キャンセル発生: ${tournament.title}（料率 ${fee.feeRate}% / ¥${fee.feeAmount}）`,
      });
    }

    // ※繰り上がり（waitlist OFFER）処理は本実装ではスタブ（Cron未実装）。
    //   枠が解放されたことを通知ログに記録するに留める。

    revalidatePath("/tournaments");
    return {
      ok: true,
      message: fee.isPaid
        ? `キャンセルを受け付けました（キャンセル料 ${fee.feeRate}%）。`
        : "キャンセルを受け付けました（無料）。",
    };
  } catch {
    return { ok: false, message: "キャンセル処理でエラーが発生しました。" };
  }
}

// ---- メンバー更新（未定枠割当・差し替え） ----
export async function updateMembersAction(
  input: unknown,
): Promise<EntryActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "ログインが必要です。" };

  const parsed = updateMembersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。",
    };
  }
  const data = parsed.data;

  const user = findUserById(session.sub);
  if (!user) return { ok: false, message: "ユーザーが見つかりません。" };

  const entry = findEntryById(data.entryId);
  if (!entry) return { ok: false, message: "エントリーが見つかりません。" };

  // 権限: 本人・チーム代表者・管理者（requirements-detail-user.md 3.2）。
  let allowed = entry.userId === user.id;
  if (!allowed && entry.teamId) {
    const team = findTeamById(entry.teamId);
    allowed = team?.leaderUserId === user.id;
  }
  if (!allowed && user.isAdmin) allowed = true;
  if (!allowed) {
    return { ok: false, message: "メンバーを変更する権限がありません。" };
  }

  const tournament = findTournamentWithStats(entry.tournamentId);
  if (!tournament) return { ok: false, message: "大会が見つかりません。" };

  // 変更期限: 開催日の3日前（00:00:00）以降は原則不可（管理者は可）。
  const fee = calculateCancelFee(tournament.eventDate, 0);
  if (fee.daysBefore < 3 && !user.isAdmin) {
    return {
      ok: false,
      message: "メンバー変更は開催3日前までです。期限を過ぎています。",
    };
  }

  try {
    replaceEntryMembers(entry.id, toRepoMembers(data.members));
    revalidatePath("/tournaments");
    return { ok: true, message: "メンバー構成を更新しました。" };
  } catch {
    return { ok: false, message: "メンバー更新でエラーが発生しました。" };
  }
}

// ---- 申込中・エントリー済み一覧の取得（モーダル表示用） ----
export interface MyEntriesResult {
  personal: EntrySummary[];
  team: EntrySummary[];
  teamName: string | null;
}

export async function getMyEntriesAction(): Promise<MyEntriesResult> {
  const session = await getSession();
  if (!session) return { personal: [], team: [], teamName: null };

  const user = findUserById(session.sub);
  if (!user) return { personal: [], team: [], teamName: null };

  const personal = listEntrySummaries({ userId: user.id, scope: "personal" });

  // 代表を務めるチームがあればチームエントリーも取得。
  const { findTeamByLeader } = await import(
    "@/features/teams/server/teamRepository"
  );
  const team = findTeamByLeader(user.id);
  const teamEntries = team
    ? listEntrySummaries({ userId: user.id, teamId: team.id, scope: "team" })
    : [];

  return {
    personal,
    team: teamEntries,
    teamName: team?.name ?? null,
  };
}
