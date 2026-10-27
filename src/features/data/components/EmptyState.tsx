// 空状態表示（共通）。データ未記録／条件不一致の説明テキストを表示する。
// Server / Client いずれからも利用可能（インタラクションを持たない）。
// 重要情報は HTML テキストとして提示する（Requirement 1.7 / 10.3）。

import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  // 空状態の説明テキスト（データ未記録／条件不一致などの理由）。
  message: string;
  // 補足説明（任意）。
  description?: string;
  className?: string;
};

export function EmptyState({ message, description, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-slate-600">{message}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}
