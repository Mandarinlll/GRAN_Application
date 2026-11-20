// 一覧のロック中の行に出す「ロック解除」ボタン。確認ダイアログ（OperationDialog）経由で実行する。
"use client";

import { useCallback, useState } from "react";
import { LockOpen } from "lucide-react";
import { OperationDialog } from "./OperationDialog";

export function UnlockUserButton({
  userId,
  targetName,
}: {
  userId: string;
  targetName: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <LockOpen className="h-4 w-4" aria-hidden="true" />
        ロック解除
      </button>
      <OperationDialog
        open={open}
        targetName={targetName}
        operationLabel="ロック解除"
        description="ログイン失敗回数をリセットし、ログインできる状態に戻します。"
        method="POST"
        url={`/api/admin/users/${userId}/unlock`}
        successMessage="ロックを解除しました"
        onClose={close}
      />
    </>
  );
}
