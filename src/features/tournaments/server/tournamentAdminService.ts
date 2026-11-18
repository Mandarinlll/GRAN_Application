// 管理者向け大会管理のサービス層。画像・トランザクション・通知を調停する。
// 画像の保存順序: 検証 → 保存 → DB 更新 → 成功後に旧画像削除。失敗時は保存済みの新画像を削除する。

import { revalidatePath } from "next/cache";
import { imageStorage, type ImageStorage } from "@/features/teams/server/imageStorage";
import { logNotification } from "@/features/notifications/server/notificationRepository";
import {
  cancelTournamentTx,
  getCancelImpactCounts,
  updateStatusRow,
} from "@/features/tournaments/server/cancelRepository";
import {
  canTransition,
  missingRequiredFields,
} from "@/features/tournaments/utils/statusTransitions";
import type { TournamentStatus } from "@/features/tournaments/types/tournament";
import type { AdminContext } from "@/features/admin/types/permissions";
import { findDuplicateRows } from "@/features/tournaments/utils/bulk";
import {
  adminBulkSchema,
  adminTournamentSchema,
  adminUpdateSchema,
  flattenAdminIssues,
} from "@/features/tournaments/types/adminSchema";
import type {
  AdminTournament,
  CancelImpact,
  ChangeStatusData,
  FieldErrors,
  PreviewRow,
  ServiceResult,
  TournamentInput,
} from "@/features/tournaments/types/adminTournament";
import { parseImageKey, toImageUrl } from "@/features/tournaments/utils/adminImageUrl";
import { processTournamentImage } from "@/features/tournaments/server/imageProcessor";
import {
  countConfirmed,
  deleteTournamentRow,
  findAdminTournamentById,
  hasAnyEntries,
  hasCopyReferences,
  insertTournament,
  insertTournamentsBulk,
  updateTournamentRow,
} from "@/features/tournaments/server/tournamentAdminRepository";

// 中止通知の送信抽象。実送信は未実装（stubSender は常に成功）。失敗時は throw する。
export interface NotificationSender {
  sendTournamentCancelled(
    to: { userId: string; email: string },
    t: { id: string; title: string },
  ): Promise<void>;
}

export const stubSender: NotificationSender = {
  async sendTournamentCancelled() {
    // 実送信は未実装。
  },
};

export interface Deps {
  storage: ImageStorage;
  sender: NotificationSender;
  now: () => Date;
}

export const defaultDeps: Deps = {
  storage: imageStorage,
  sender: stubSender,
  now: () => new Date(),
};

const IMAGE_PREFIX = "tournament";
const DB_ERROR_MESSAGE = "保存に失敗しました。時間をおいて再度お試しください。";
const DELETE_WARNING = "古い画像ファイルの削除に失敗しました。";

function fail<T = never>(
  code: Extract<ServiceResult, { ok: false }>["code"],
  message: string,
  extra: { fieldErrors?: FieldErrors; httpStatus?: number } = {},
): ServiceResult<T> {
  return { ok: false, code, message, ...extra };
}

type ImageStep =
  | { ok: true; key: string | null }
  | { ok: false; result: ServiceResult<never> };

// 画像の検証と保存。ファイルが無ければ key は null。
async function validateAndSaveImage(
  file: Uint8Array | null | undefined,
  storage: ImageStorage,
): Promise<ImageStep> {
  if (!file) return { ok: true, key: null };
  const image = await processTournamentImage(file);
  if (!image.ok) {
    return {
      ok: false,
      result: fail("IMAGE", image.message, {
        fieldErrors: { image: image.message },
        httpStatus: image.status,
      }),
    };
  }
  try {
    const key = await storage.save(IMAGE_PREFIX, image.bytes, image.extension);
    return { ok: true, key };
  } catch {
    return { ok: false, result: fail("DB_ERROR", "画像の保存に失敗しました。") };
  }
}

// 後始末。削除の失敗は握りつぶす（元のエラーを優先する）。
async function discardImage(storage: ImageStorage, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await storage.delete(key);
  } catch {
    // 後始末の失敗は無視する
  }
}

// ---- 登録 ----

// copyFromId を指定するとコピー作成になる（copy_from_id を設定し、draw_pdf_url は NULL のまま）。
// ファイル未指定のコピーは、コピー元の管理対象画像を別キーで複製する。
export async function createTournament(
  _admin: AdminContext,
  raw: Record<string, unknown>,
  file?: Uint8Array | null,
  copyFromId?: string | null,
  deps: Deps = defaultDeps,
): Promise<ServiceResult<{ id: string }>> {
  const parsed = adminTournamentSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", "入力内容を確認してください。", {
      fieldErrors: flattenAdminIssues(parsed.error) as FieldErrors,
    });
  }
  const input = parsed.data as TournamentInput;

  let source: AdminTournament | null = null;
  if (copyFromId) {
    source = findAdminTournamentById(copyFromId);
    if (!source) return fail("NOT_FOUND", "コピー元の大会が見つかりません。");
  }

  let newKey: string | null = null;
  let imageUrl: string | null = null;
  if (file) {
    const image = await validateAndSaveImage(file, deps.storage);
    if (!image.ok) return image.result;
    newKey = image.key;
    imageUrl = newKey ? toImageUrl(newKey) : null;
  } else if (source?.imageUrl) {
    const srcKey = parseImageKey(source.imageUrl);
    if (srcKey) {
      const message = "要項画像の複製に失敗しました。";
      try {
        const bytes = await deps.storage.read(srcKey);
        if (!bytes) return fail("IMAGE", message, { fieldErrors: { image: message } });
        const ext = srcKey.slice(srcKey.lastIndexOf(".") + 1);
        newKey = await deps.storage.save(IMAGE_PREFIX, bytes, ext);
        imageUrl = toImageUrl(newKey);
      } catch {
        await discardImage(deps.storage, newKey);
        return fail("IMAGE", message, { fieldErrors: { image: message } });
      }
    } else {
      // 管理対象外（外部 URL など）は複製できないため、そのまま引き継ぐ。
      imageUrl = source.imageUrl;
    }
  }

  let id: string;
  try {
    id = insertTournament(input, { imageUrl, copyFromId: source ? source.id : null });
  } catch {
    await discardImage(deps.storage, newKey);
    return fail("DB_ERROR", DB_ERROR_MESSAGE);
  }
  return { ok: true, data: { id } };
}

// ---- 一括登録 ----

type BulkValidated =
  | { ok: true; inputs: TournamentInput[] }
  | { ok: false; result: ServiceResult<never> };

// 検証（スキーマ + 重複）。エラーは行番号（1 始まり）つきで返す。
function validateBulk(raw: Record<string, unknown>): BulkValidated {
  const parsed = adminBulkSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = flattenAdminIssues(parsed.error);
    const fieldErrors: Record<string, string> = {};
    for (const [key, message] of Object.entries(flat)) {
      const m = /^rows\.(\d+)\./.exec(key);
      fieldErrors[key] = m ? `${Number(m[1]) + 1}行目: ${message}` : message;
    }
    return {
      ok: false,
      result: fail("VALIDATION", "入力内容を確認してください。", {
        fieldErrors: fieldErrors as FieldErrors,
      }),
    };
  }
  const inputs = parsed.data as TournamentInput[];
  const dups = findDuplicateRows(inputs);
  if (dups.length > 0) {
    const fieldErrors: Record<string, string> = {};
    for (const n of dups) {
      fieldErrors[`rows.${n - 1}.title`] = `${n}行目: 開催日・種目区分・大会名が他の行と重複しています。`;
    }
    return {
      ok: false,
      result: fail(
        "VALIDATION",
        `重複している行があります（${dups.join("、")}行目）。`,
        { fieldErrors: fieldErrors as FieldErrors },
      ),
    };
  }
  return { ok: true, inputs };
}

// プレビュー。何も保存しない（画像は検証のみ）。
export async function previewBulk(
  _admin: AdminContext,
  raw: Record<string, unknown>,
  file?: Uint8Array | null,
): Promise<ServiceResult<{ rows: PreviewRow[] }>> {
  const v = validateBulk(raw);
  if (!v.ok) return v.result;
  if (file) {
    const image = await processTournamentImage(file);
    if (!image.ok) {
      return fail("IMAGE", image.message, {
        fieldErrors: { image: image.message },
        httpStatus: image.status,
      });
    }
  }
  return {
    ok: true,
    data: { rows: v.inputs.map((input, i) => ({ rowNumber: i + 1, input })) },
  };
}

// 確定登録。全件を 1 トランザクションで保存し、画像は大会ごとに別キーで保存する。
export async function createBulk(
  _admin: AdminContext,
  raw: Record<string, unknown>,
  file?: Uint8Array | null,
  deps: Deps = defaultDeps,
): Promise<ServiceResult<{ ids: string[] }>> {
  const v = validateBulk(raw);
  if (!v.ok) return v.result;

  const keys: string[] = [];
  if (file) {
    const image = await processTournamentImage(file);
    if (!image.ok) {
      return fail("IMAGE", image.message, {
        fieldErrors: { image: image.message },
        httpStatus: image.status,
      });
    }
    try {
      for (let i = 0; i < v.inputs.length; i++) {
        keys.push(await deps.storage.save(IMAGE_PREFIX, image.bytes, image.extension));
      }
    } catch {
      for (const k of keys) await discardImage(deps.storage, k);
      return fail("DB_ERROR", "画像の保存に失敗しました。");
    }
  }

  try {
    const ids = insertTournamentsBulk(
      v.inputs.map((input, i) => ({
        input,
        imageUrl: keys[i] ? toImageUrl(keys[i]) : null,
      })),
    );
    return { ok: true, data: { ids } };
  } catch {
    for (const k of keys) await discardImage(deps.storage, k);
    return fail("DB_ERROR", DB_ERROR_MESSAGE);
  }
}

// ---- 削除 ----

export async function deleteTournament(
  _admin: AdminContext,
  id: string,
  deps: Deps = defaultDeps,
): Promise<ServiceResult<{ imageWarning?: string }>> {
  const current = findAdminTournamentById(id);
  if (!current) return fail("NOT_FOUND", "大会が見つかりません。");
  if (current.status !== "DRAFT") {
    return fail(
      "NOT_DRAFT",
      "下書き以外の大会は削除できません。不要な場合は中止（CANCELLED）をご利用ください。",
    );
  }
  if (hasAnyEntries(id)) {
    return fail("HAS_ENTRIES", "エントリーが存在するため削除できません。");
  }
  if (hasCopyReferences(id)) {
    return fail("HAS_COPIES", "他の大会から複製元として参照されているため削除できません。");
  }

  try {
    if (!deleteTournamentRow(id)) return fail("NOT_FOUND", "大会が見つかりません。");
  } catch {
    return fail("DB_ERROR", "削除に失敗しました。時間をおいて再度お試しください。");
  }

  // DB 削除の成功後に画像を削除する。失敗しても削除結果は維持し、警告で返す。
  const key = parseImageKey(current.imageUrl);
  if (key) {
    try {
      await deps.storage.delete(key);
    } catch {
      const imageWarning = "要項画像の削除に失敗しました。";
      return { ok: true, data: { imageWarning }, warning: imageWarning };
    }
  }
  return { ok: true, data: {} };
}

// ---- 更新 ----

export async function updateTournament(
  _admin: AdminContext,
  id: string,
  raw: Record<string, unknown>,
  file?: Uint8Array | null,
  deps: Deps = defaultDeps,
): Promise<ServiceResult<AdminTournament>> {
  const parsed = adminUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("VALIDATION", "入力内容を確認してください。", {
      fieldErrors: flattenAdminIssues(parsed.error) as FieldErrors,
    });
  }
  const { expectedUpdatedAt, ...rest } = parsed.data as TournamentInput & {
    expectedUpdatedAt: string;
    copyFromId?: unknown;
  };
  const input = rest as TournamentInput;

  const current = findAdminTournamentById(id);
  if (!current) return fail("NOT_FOUND", "大会が見つかりません。");

  const STALE_MESSAGE = "他の操作で更新されています。画面を再読み込みしてください。";
  if (current.updatedAt !== expectedUpdatedAt) return fail("CONFLICT_STALE", STALE_MESSAGE);

  // 終了済み・中止済みは開催日・定員・参加費を変更できない。
  if (current.status === "FINISHED" || current.status === "CANCELLED") {
    const locked: FieldErrors = {};
    if (input.eventDate !== current.eventDate) locked.eventDate = "この大会の開催日は変更できません。";
    if (input.capacity !== current.capacity) locked.capacity = "この大会の定員は変更できません。";
    if (input.entryFee !== current.entryFee) locked.entryFee = "この大会の参加費は変更できません。";
    if (Object.keys(locked).length > 0) {
      return fail("LOCKED_FIELD", "終了・中止した大会の開催日・定員・参加費は変更できません。", {
        fieldErrors: locked,
      });
    }
  }

  const confirmed = countConfirmed(id);
  if (input.capacity < confirmed) {
    const message = `定員は現在の確定エントリー数（${confirmed}件）以上にしてください。`;
    return fail("CAPACITY_BELOW_CONFIRMED", message, { fieldErrors: { capacity: message } });
  }

  const image = await validateAndSaveImage(file, deps.storage);
  if (!image.ok) return image.result;

  let updated: boolean;
  try {
    updated = updateTournamentRow(id, input, expectedUpdatedAt, {
      imageUrl: image.key ? toImageUrl(image.key) : undefined,
    });
  } catch {
    await discardImage(deps.storage, image.key);
    return fail("DB_ERROR", DB_ERROR_MESSAGE);
  }
  if (!updated) {
    await discardImage(deps.storage, image.key);
    return fail("CONFLICT_STALE", STALE_MESSAGE);
  }

  // 成功後に旧画像を削除する（管理対象外の画像は消さない）。失敗は警告として返す。
  let warning: string | undefined;
  const oldKey = image.key ? parseImageKey(current.imageUrl) : null;
  if (oldKey) {
    try {
      await deps.storage.delete(oldKey);
    } catch {
      warning = DELETE_WARNING;
    }
  }

  const fresh = findAdminTournamentById(id);
  if (!fresh) return fail("NOT_FOUND", "大会が見つかりません。");
  return { ok: true, data: fresh, ...(warning ? { warning } : {}) };
}

// ---- ステータス変更・中止 ----

// 中止確認ダイアログ用の 4 件数（確定数、待ち数、請求中数、入金済み数）。
export function getCancelImpact(id: string): CancelImpact {
  return getCancelImpactCounts(id);
}

function revalidateUserViews(): void {
  try {
    revalidatePath("/tournaments");
    revalidatePath("/home");
  } catch {
    // リクエスト外（テスト等）では再検証できない。ステータス変更の結果には影響させない。
  }
}

const STATUS_STALE_MESSAGE = "他の操作で更新されています。画面を再読み込みしてください。";

export async function changeStatus(
  _admin: AdminContext,
  id: string,
  params: {
    to: TournamentStatus;
    expectedStatus: TournamentStatus;
    expectedUpdatedAt: string;
  },
  deps: Deps = defaultDeps,
): Promise<ServiceResult<ChangeStatusData>> {
  const { to, expectedStatus, expectedUpdatedAt } = params;
  const current = findAdminTournamentById(id);
  if (!current) return fail("NOT_FOUND", "大会が見つかりません。");

  if (current.status !== expectedStatus || current.updatedAt !== expectedUpdatedAt) {
    return fail("CONFLICT_STALE", STATUS_STALE_MESSAGE);
  }

  if (!canTransition(current.status, to)) {
    const message =
      current.status === "FINISHED" || current.status === "CANCELLED"
        ? "終了・中止した大会のステータスは変更できません。"
        : "このステータスへは変更できません。";
    return fail("FORBIDDEN_TRANSITION", message);
  }

  if (to === "OPEN") {
    const missing = missingRequiredFields(current);
    if (missing.length > 0) {
      return fail(
        "VALIDATION",
        `募集中にするには次の項目を保存してください: ${missing.join("、")}`,
        { fieldErrors: { form: `未設定の項目: ${missing.join("、")}` } },
      );
    }
  }

  if (to !== "CANCELLED") {
    let updated: boolean;
    try {
      updated = updateStatusRow(id, to, expectedStatus, expectedUpdatedAt);
    } catch {
      return fail("DB_ERROR", DB_ERROR_MESSAGE);
    }
    if (!updated) return fail("CONFLICT_STALE", STATUS_STALE_MESSAGE);
    const fresh = findAdminTournamentById(id);
    revalidateUserViews();
    return {
      ok: true,
      data: { status: to, updatedAt: fresh ? fresh.updatedAt : current.updatedAt },
    };
  }

  // 中止: 大会・キャンセル待ち・請求中キャンセルを同一トランザクションで更新する。
  let tx: ReturnType<typeof cancelTournamentTx>;
  try {
    tx = cancelTournamentTx(id, expectedStatus, expectedUpdatedAt);
  } catch {
    return fail("DB_ERROR", DB_ERROR_MESSAGE);
  }
  if (!tx.ok) return fail("CONFLICT_STALE", STATUS_STALE_MESSAGE);

  // コミット後に通知する。失敗してもステータスは維持する。
  let failed = 0;
  for (const r of tx.recipients) {
    const payload = JSON.stringify({ tournamentId: id, title: current.title });
    let errorMessage: string | null = null;
    try {
      await deps.sender.sendTournamentCancelled(
        { userId: r.userId, email: r.email },
        { id, title: current.title },
      );
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "送信に失敗しました。";
    }
    try {
      logNotification({
        deliveryType: "TOURNAMENT_CANCELLED",
        userId: r.userId,
        recipientEmail: r.email,
        tournamentId: id,
        entryId: r.entryId,
        messagePayload: payload,
        status: errorMessage === null ? "SUCCESS" : "FAILED",
        errorMessage,
      });
    } catch {
      errorMessage = errorMessage ?? "通知ログの記録に失敗しました。";
    }
    if (errorMessage !== null) failed++;
  }

  revalidateUserViews();
  return {
    ok: true,
    data: {
      status: "CANCELLED",
      updatedAt: tx.updatedAt,
      notify: { total: tx.recipients.length, failed },
    },
  };
}
