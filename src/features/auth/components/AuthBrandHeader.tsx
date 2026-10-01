// 認証画面共通のブランドヘッダー（ロゴ + タイトル）。
// ui-design-system.md のカラートークンに準拠。

import { Trophy } from "lucide-react";

type Props = {
  subtitle: string;
};

export function AuthBrandHeader({ subtitle }: Props) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-md mb-3">
        <Trophy className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
        GRANde
      </h1>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}
