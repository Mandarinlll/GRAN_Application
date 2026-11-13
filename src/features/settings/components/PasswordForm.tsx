// パスワード変更フォーム。成功時はフォームをリセットする。
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, type ToastState } from "@/components/ui/Toast";
import {
  changePasswordAction,
  type SettingsActionState,
} from "@/features/settings/server/actions";
import {
  Field,
  FormMessage,
  SectionCard,
  inputBase,
} from "@/features/settings/components/fields";

const initialState: SettingsActionState = { ok: false };

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.nonce && state.ok && state.message) {
      setToast({ message: state.message, type: "success" });
      formRef.current?.reset();
    }
  }, [state]);

  const fe = state.fieldErrors ?? {};

  return (
    <SectionCard
      title="パスワード変更"
      description="8文字以上で、英字と数字をそれぞれ1文字以上含めてください。"
      icon={<Lock className="w-4 h-4" />}
    >
      {!state.ok ? <FormMessage message={state.message} /> : null}
      <form ref={formRef} action={formAction} className="space-y-4" noValidate>
        <Field label="現在のパスワード" htmlFor="currentPassword" error={fe.currentPassword}>
          <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className={inputBase} aria-invalid={!!fe.currentPassword} />
        </Field>
        <Field label="新しいパスワード" htmlFor="newPassword" error={fe.newPassword}>
          <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" className={inputBase} aria-invalid={!!fe.newPassword} />
        </Field>
        <Field label="新しいパスワード（確認）" htmlFor="newPasswordConfirm" error={fe.newPasswordConfirm}>
          <input id="newPasswordConfirm" name="newPasswordConfirm" type="password" autoComplete="new-password" className={inputBase} aria-invalid={!!fe.newPasswordConfirm} />
        </Field>
        <Button type="submit" size="md" className="w-full sm:w-auto" isLoading={isPending}>
          パスワードを変更
        </Button>
      </form>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </SectionCard>
  );
}
