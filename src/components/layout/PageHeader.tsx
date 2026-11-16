// 各ページ共通の見出し（アイコンタイル + H1 + 右側アクション）。
// ui-design-system.md: H1 は text-xl font-bold。画面間で見出しの見た目を統一する。
import type { ComponentType, ReactNode } from "react";

type Props = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  // 右端に置くボタンなど。
  action?: ReactNode;
};

export function PageHeader({ icon: Icon, title, action }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}