// ユーザー情報（氏名・フリガナ・ニックネーム・電話番号・メールアドレス）の編集フォーム。
"use client";

import { useActionState, useEffect, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, type ToastState } from "@/components/ui/Toast";
import {
  updateProfileAction,
  type SettingsActionState,
} from "@/features/settings/server/actions";
import {
  Field,
  FormMessage,
  SectionCard,
  inputBase,
} from "@/features/settings/components/fields";

export interface ProfileDefaults {
  loginId: string;
  lastName: string;
  firstName: string;
  lastKana: string;
  firstKana: string;
  nickname: string;
  phoneNumber: string;
  email: string;
}

const initialState: SettingsActionState = { ok: false };

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (state.nonce && state.ok && state.message) {
      setToast({ message: state.message, type: "success" });
    }
  }, [state]);

  const v = { ...defaults, ...(state.values ?? {}) };
  const fe = state.fieldErrors ?? {};

  return (
    <SectionCard
      title="ユーザー情報"
      description="登録情報の確認・変更ができます。"
      icon={<UserIcon className="w-4 h-4" />}
    >
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
        <div>
          <dt className="text-slate-500">ログインID</dt>
          <dd className="font-bold text-slate-800 tabular-nums">{defaults.loginId}</dd>
        </div>
        <div>
          <dt className="text-slate-500">階級・GRANレベル</dt>
          <dd className="text-slate-600">運営が査定します</dd>
        </div>
      </dl>

      {!state.ok ? <FormMessage message={state.message} /> : null}

      <form action={formAction} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓" htmlFor="lastName" error={fe.lastName}>
            <input id="lastName" name="lastName" defaultValue={v.lastName} autoComplete="family-name" className={inputBase} aria-invalid={!!fe.lastName} />
          </Field>
          <Field label="名" htmlFor="firstName" error={fe.firstName}>
            <input id="firstName" name="firstName" defaultValue={v.firstName} autoComplete="given-name" className={inputBase} aria-invalid={!!fe.firstName} />
          </Field>
          <Field label="セイ（フリガナ）" htmlFor="lastKana" error={fe.lastKana}>
            <input id="lastKana" name="lastKana" defaultValue={v.lastKana} className={inputBase} aria-invalid={!!fe.lastKana} />
          </Field>
          <Field label="メイ（フリガナ）" htmlFor="firstKana" error={fe.firstKana}>
            <input id="firstKana" name="firstKana" defaultValue={v.firstKana} className={inputBase} aria-invalid={!!fe.firstKana} />
          </Field>
        </div>

        <Field
          label="ニックネーム"
          htmlFor="nickname"
          error={fe.nickname}
          hint="他のユーザーに公開されます。個人情報を含めないでください。"
        >
          <input id="nickname" name="nickname" defaultValue={v.nickname} maxLength={40} className={inputBase} aria-invalid={!!fe.nickname} />
        </Field>

        <Field label="電話番号" htmlFor="phoneNumber" error={fe.phoneNumber} hint="数字とハイフンで入力（例: 090-1234-5678）">
          <input id="phoneNumber" name="phoneNumber" type="tel" inputMode="tel" defaultValue={v.phoneNumber} autoComplete="tel" className={inputBase} aria-invalid={!!fe.phoneNumber} />
        </Field>

        <Field label="メールアドレス" htmlFor="email" error={fe.email}>
          <input id="email" name="email" type="email" defaultValue={v.email} autoComplete="email" className={inputBase} aria-invalid={!!fe.email} />
        </Field>

        <Button type="submit" size="md" className="w-full sm:w-auto" isLoading={isPending}>
          変更を保存
        </Button>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </SectionCard>
  );
}
