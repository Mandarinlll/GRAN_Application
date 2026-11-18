// 大会削除の確認ダイアログ（大会名を表示。Requirement 10.1, 10.2）。
"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Props = {
  open: boolean;
  tournamentTitle: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function DeleteConfirmDialog({ open, tournamentTitle, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog
      open={open}
      title="大会を削除しますか？"
      description={
        <>
          「<span className="font-bold text-slate-900">{tournamentTitle}</span>
          」を削除します。この操作は元に戻せません。
        </>
      }
      confirmLabel="削除する"
      cancelLabel="キャンセル"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
