// ユーザー詳細（全項目・所属チーム・有効エントリー数・操作履歴）と、各管理操作。
"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, KeyRound, Lock, LockOpen, Play, ShieldCheck, Trash2, Gauge } from "lucide-react";
import type { UserDetail } from "@/features/accounts/types/account";
import { displayOrUnset } from "../utils/format";
import { OperationDialog } from "./OperationDialog";
import { InitialPasswordNotice } from "./InitialPasswordNotice";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理者",
  OPERATOR: "運営",
  LEADER: "チーム代表",
  USER: "一般",
};
const ROLE_OPTIONS = ["ADMIN", "OPERATOR", "LEADER", "USER"] as const;
const STATUS_LABEL: Record<string, string> = { ACTIVE: "有効", SUSPENDED: "停止中", PROVISIONAL: "仮登録" };
const GENDER_LABEL: Record<string, string> = { MALE: "男性", FEMALE: "女性", OTHER: "その他" };
const ACTION_LABEL: Record<string, string> = {
  USER_CREATED: "アカウント作成",
  LOCK_RELEASED: "ロック解除",
  PASSWORD_RESET: "パスワード再発行",
  ACCOUNT_SUSPENDED: "アカウント停止",
  ACCOUNT_REACTIVATED: "アカウント再開",
  ROLE_CHANGED: "権限変更",
  LEVEL_CALIBRATED: "初期レベル査定",
  USER_DELETED: "ユーザー削除",
};

const sectionClass = "space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6";
const emptyClass = "rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-600";
const btnBase =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const neutralButton = `${btnBase} border-slate-200 text-slate-800 hover:bg-slate-50 focus-visible:ring-emerald-500`;
const dangerButton = `${btnBase} border-rose-600 text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-500`;

type Op = "unlock" | "reset" | "suspend" | "reactivate" | "role" | "delete" | null;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-all text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function UserDetailView({ user }: { user: UserDetail }) {
  const router = useRouter();
  const [op, setOp] = useState<Op>(null);
  const [newRole, setNewRole] = useState<string>(user.role);
  const [password, setPassword] = useState<string | null>(null);
  const close = useCallback(() => setOp(null), []);
  const onReset = useCallback((data: Record<string, unknown>) => {
    if (typeof data.initialPassword === "string") setPassword(data.initialPassword);
  }, []);
  const onDeleted = useCallback(() => router.replace("/admin/users"), [router]);
  const roleBody = useMemo(() => ({ role: newRole }), [newRole]);
  const deleteConfirm = useMemo(
    () => ({ label: "確認のためユーザーIDを入力してください", bodyKey: "confirmLoginId", hint: user.loginId }),
    [user.loginId],
  );

  const name = `${user.realName}（${user.loginId}）`;
  const base = `/api/admin/users/${user.id}`;

  return (
    <div className="space-y-4">
      {password && (
        <InitialPasswordNotice
          password={password}
          title="パスワードを再発行しました"
          onDismiss={() => setPassword(null)}
        />
      )}

      <section className={sectionClass} aria-labelledby="user-profile">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="user-profile" className="text-base font-bold text-slate-900">
            基本情報
          </h2>
          {user.locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
              <Lock className="h-3 w-3" aria-hidden="true" />
              ロック中
            </span>
          )}
          {user.status === "SUSPENDED" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              <Ban className="h-3 w-3" aria-hidden="true" />
              停止中
            </span>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ユーザーID">
            <span className="tabular-nums">{user.loginId}</span>
          </Field>
          <Field label="氏名">{displayOrUnset(user.realName)}</Field>
          <Field label="フリガナ">{displayOrUnset(user.kanaName)}</Field>
          <Field label="ニックネーム">{displayOrUnset(user.nickname)}</Field>
          <Field label="メールアドレス">{displayOrUnset(user.email)}</Field>
          <Field label="性別">{user.gender ? (GENDER_LABEL[user.gender] ?? user.gender) : displayOrUnset(null)}</Field>
          <Field label="生年月日">
            <span className="tabular-nums">{displayOrUnset(user.birthDate)}</span>
          </Field>
          <Field label="電話番号">
            <span className="tabular-nums">{displayOrUnset(user.phoneNumber)}</span>
          </Field>
          <Field label="権限">{ROLE_LABEL[user.role] ?? user.role}</Field>
          <Field label="アカウント状態">{STATUS_LABEL[user.status] ?? user.status}</Field>
          <Field label="申告階級">{displayOrUnset(user.declaredClass)}</Field>
          <Field label="Gran Level">
            <span className="tabular-nums">{user.granLevel}</span>
            {user.isLevelCalibrated ? "" : "（未査定）"}
          </Field>
          <Field label="ログイン失敗回数">
            <span className="tabular-nums">{user.failedLoginAttempts}</span>
          </Field>
          <Field label="ロック期限">
            <span className="tabular-nums">{displayOrUnset(user.lockedUntil)}</span>
          </Field>
          <Field label="登録日時">
            <span className="tabular-nums">{displayOrUnset(user.createdAt)}</span>
          </Field>
          <Field label="有効なエントリー数">
            <span className="tabular-nums">{user.activePersonalEntryCount}</span>件
          </Field>
        </dl>
      </section>

      <section className={sectionClass} aria-labelledby="user-teams">
        <h2 id="user-teams" className="text-base font-bold text-slate-900">
          チーム
        </h2>
        <p className="text-sm text-slate-700">
          代表を務めるチーム:{" "}
          {user.ledTeam ? (
            <Link
              href={`/admin/teams/${user.ledTeam.id}`}
              className="inline-flex min-h-[44px] items-center break-all font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {user.ledTeam.name}
            </Link>
          ) : (
            "なし"
          )}
        </p>
        <div>
          <h3 className="text-sm font-medium text-slate-800">所属チーム</h3>
          {user.teams.length === 0 ? (
            <p className={emptyClass}>所属チームなし</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {user.teams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/teams/${t.id}`}
                    className="inline-flex min-h-[44px] items-center break-all font-medium text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {t.name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">代表者: {t.leaderNickname}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="user-ops">
        <h2 id="user-ops" className="text-base font-bold text-slate-900">
          操作
        </h2>
        <div className="flex flex-wrap gap-2">
          {user.locked && (
            <button type="button" onClick={() => setOp("unlock")} className={neutralButton}>
              <LockOpen className="h-4 w-4" aria-hidden="true" />
              ロック解除
            </button>
          )}
          <button type="button" onClick={() => setOp("reset")} className={neutralButton}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            パスワード再発行
          </button>
          {user.status === "ACTIVE" && (
            <button type="button" onClick={() => setOp("suspend")} className={dangerButton}>
              <Ban className="h-4 w-4" aria-hidden="true" />
              アカウント停止
            </button>
          )}
          {user.status === "SUSPENDED" && (
            <button type="button" onClick={() => setOp("reactivate")} className={neutralButton}>
              <Play className="h-4 w-4" aria-hidden="true" />
              アカウント再開
            </button>
          )}
          <Link href={`/admin/users/${user.id}/calibrate`} className={neutralButton}>
            <Gauge className="h-4 w-4" aria-hidden="true" />
            初期レベル査定
          </Link>
          <button type="button" onClick={() => setOp("delete")} className={dangerButton}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            ユーザー削除
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="user-role-select" className="block text-xs text-slate-500">
              権限
            </label>
            <select
              id="user-role-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="block min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setOp("role")}
            disabled={newRole === user.role}
            className={`${neutralButton} disabled:cursor-not-allowed disabled:text-slate-400`}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            権限を変更
          </button>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="user-logs">
        <h2 id="user-logs" className="text-base font-bold text-slate-900">
          操作履歴
        </h2>
        {user.logs.length === 0 ? (
          <p className={emptyClass}>操作履歴なし</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {user.logs.map((l) => (
              <li key={l.id} className="space-y-0.5 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{ACTION_LABEL[l.action] ?? l.action}</span>
                  <span className="text-xs text-slate-600 tabular-nums">{l.createdAt.slice(0, 16)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  操作者: <span className="tabular-nums">{l.operatorLoginId}</span>
                </p>
                {l.detail && <p className="break-all text-xs text-slate-500">{l.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <OperationDialog
        open={op === "unlock"}
        targetName={name}
        operationLabel="ロック解除"
        method="POST"
        url={`${base}/unlock`}
        successMessage="ロックを解除しました"
        onClose={close}
      />
      <OperationDialog
        open={op === "reset"}
        targetName={name}
        operationLabel="パスワード再発行"
        description="既存のログイン状態は無効になります。新しい初期パスワードは一度だけ表示されます。"
        method="POST"
        url={`${base}/reset-password`}
        successMessage="パスワードを再発行しました"
        onSuccess={onReset}
        onClose={close}
      />
      <OperationDialog
        open={op === "suspend"}
        targetName={name}
        operationLabel="アカウント停止"
        description="対象ユーザーはログインできなくなり、既存のログイン状態も無効になります。"
        confirmLabel="停止する"
        variant="destructive"
        method="POST"
        url={`${base}/suspend`}
        successMessage="アカウントを停止しました"
        onClose={close}
      />
      <OperationDialog
        open={op === "reactivate"}
        targetName={name}
        operationLabel="アカウント再開"
        method="POST"
        url={`${base}/reactivate`}
        successMessage="アカウントを再開しました"
        onClose={close}
      />
      <OperationDialog
        open={op === "role"}
        targetName={name}
        operationLabel="権限変更"
        description={`「${ROLE_LABEL[user.role] ?? user.role}」から「${ROLE_LABEL[newRole] ?? newRole}」に変更します。既存のログイン状態は無効になります。`}
        confirmLabel="変更する"
        method="POST"
        url={`${base}/role`}
        body={roleBody}
        successMessage="権限を変更しました"
        onClose={close}
      />
      <OperationDialog
        open={op === "delete"}
        targetName={name}
        operationLabel="ユーザー削除"
        description="この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        method="DELETE"
        url={base}
        confirm={deleteConfirm}
        successMessage="ユーザーを削除しました"
        onSuccess={onDeleted}
        onClose={close}
      />
    </div>
  );
}
