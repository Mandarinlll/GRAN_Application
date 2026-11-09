"use server";

// エントリー機能の Server Actions
// （単一申込 / 一括申込 / キャンセル待ち / キャンセル / メンバー更新）。
//
// 方針（oop-architecture.md §2.6）: ここは薄い "use server" アダプタに縮退させる。
//  - セッション取得・Zod 入力検証（既存どおり早期リターン）。
//  - コンポジションルート（container.ts）から EntryApplicationService を組み立てる。
//  - サービスを呼び、ドメイン例外 / SubmitOutcome を toActionResult で既存文言へマッピング。
//  - revalidatePath と、COMMIT 後の通知ログ記録（logNotification）。
// 権限判定・トランザクション境界・ドメイン前提条件は EntryApplicationService が担う（§2.5・Finding A）。

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  bulkEntryCreateSchema,
  cancelEntrySchema,
  entryCreateSchema,
  updateMembersSchema,
  waitlistCreateSchema,
} from "@/features/entries/types/schema";
import type { EntryMemberInput } from "@/features/entries/types/schema";
import type { EntrySummary, MemberType } from "@/features/entries/types/entry";
import { createEntryApplicationService } from "@/server/container";
import { toActionResult, preFullMessage } from "@/features/entries/server/toActionResult";
import type { MemberInput } from "@/features/entries/domain/EntryMember";
import { logNotification } from "@/features/notifications/server/notificationRepository";

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

// Zod のメンバー入力 → ドメインのメンバー入力へ変換。
function toMemberInputs(members: EntryMemberInput[]): MemberInput[] {
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

  const service = createEntryApplicationService();
  try {
    const outcome = service.submit({
      tournamentId: data.tournamentId,
      userId: session.sub,
      teamId: data.teamId ?? null,
      members: toMemberInputs(data.members),
      acknowledgeConflict: data.acknowledgeConflict,
    });

    if (outcome.kind === "preFull") {
      return { ok: false, message: preFullMessage() };
    }

    // エントリー完了通知（スタブ記録。COMMIT 後）。
    logNotification({
      deliveryType: "ENTRY_CONFIRMED",
      userId: session.sub,
      recipientEmail: outcome.recipientEmail,
      tournamentId: outcome.entry.tournamentId,
      entryId: outcome.entry.id,
      messagePayload: `エントリー完了: ${outcome.tournamentTitle}`,
    });

    revalidatePath("/tournaments");
    return {
      ok: true,
      entryId: outcome.entry.id,
      message: "エントリーが完了しました。",
    };
  } catch (error) {
    return { ...toActionResult(error, "submit") };
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

  const service = createEntryApplicationService();
  try {
    const outcome = service.submitWaitlist({
      tournamentId: data.tournamentId,
      userId: session.sub,
      teamId: data.teamId ?? null,
    });

    logNotification({
      deliveryType: "ENTRY_CONFIRMED",
      userId: session.sub,
      recipientEmail: outcome.recipientEmail,
      tournamentId: outcome.waitlist.tournamentId,
      messagePayload: `キャンセル待ち登録: ${outcome.tournamentTitle}（順位 ${outcome.waitlist.queueNumber}）`,
    });

    revalidatePath("/tournaments");
    return {
      ok: true,
      queueNumber: outcome.waitlist.queueNumber,
      message: "キャンセル待ちに登録しました。",
    };
  } catch (error) {
    return { ...toActionResult(error, "waitlist") };
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

  const service = createEntryApplicationService();
  try {
    const outcome = service.cancel({
      entryId: parsed.data.entryId,
      userId: session.sub,
    });

    // キャンセル通知（無料/有償で種別を分ける。有償は管理者通知も記録）。COMMIT 後。
    logNotification({
      deliveryType: outcome.isPaid ? "CANCEL_PAID_USER" : "CANCEL_FREE",
      userId: session.sub,
      recipientEmail: outcome.recipientEmail,
      tournamentId: outcome.tournamentId,
      entryId: outcome.entryId,
      messagePayload: `キャンセル受付: ${outcome.tournamentTitle}（料率 ${outcome.feeRate}% / ¥${outcome.feeAmount}）`,
    });
    if (outcome.isPaid) {
      logNotification({
        deliveryType: "CANCEL_PAID_ADMIN",
        tournamentId: outcome.tournamentId,
        entryId: outcome.entryId,
        messagePayload: `有償キャンセル発生: ${outcome.tournamentTitle}（料率 ${outcome.feeRate}% / ¥${outcome.feeAmount}）`,
      });
    }

    // ※繰り上がり（waitlist OFFER）処理は本実装ではスタブ（Cron未実装）。
    //   枠が解放されたことを通知ログに記録するに留める。

    revalidatePath("/tournaments");
    return {
      ok: true,
      message: outcome.isPaid
        ? `キャンセルを受け付けました（キャンセル料 ${outcome.feeRate}%）。`
        : "キャンセルを受け付けました（無料）。",
    };
  } catch (error) {
    return { ...toActionResult(error, "cancel") };
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

  const service = createEntryApplicationService();
  try {
    service.updateMembers({
      entryId: data.entryId,
      userId: session.sub,
      members: toMemberInputs(data.members),
    });
    revalidatePath("/tournaments");
    return { ok: true, message: "メンバー構成を更新しました。" };
  } catch (error) {
    return { ...toActionResult(error, "updateMembers") };
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

  const service = createEntryApplicationService();
  return service.listMyEntries(session.sub);
}
