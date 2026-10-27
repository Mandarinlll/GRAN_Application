// ランキング1行の表示（共通 UI）。
// - アバター画像。未設定／取得不能時は既定の代替アイコンを表示する（Requirement 2.8）。
// - 閲覧ユーザー自身の行は視覚的に強調し、音声読み上げ用の識別テキスト
//   「（あなた）」を付与する（Requirement 2.4 / 3.4）。
// - 順位・GRANレベルは画像ではなく HTML テキストとして表示する（Requirement 1.7）。
// - 公開プロフィール項目（ニックネーム／アイコン／GRANレベル／順位）のみを扱い、
//   非公開項目は props に受け取らない（Requirement 2.3 / 8.2 / Property 10）。

import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rank: number; // 1始まりの順位
  nickname: string; // 公開ニックネーム
  avatarUrl: string | null; // 未設定／取得不能時は null
  granLevel: number; // GRANレベル（100〜999）
  isSelf: boolean; // 閲覧ユーザー自身の行か
  className?: string;
};

export function RankRow({
  rank,
  nickname,
  avatarUrl,
  granLevel,
  isSelf,
  className,
}: Props) {
  return (
    <li
      aria-current={isSelf ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        isSelf
          ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-300"
          : "border-slate-200 bg-white",
        className,
      )}
    >
      {/* 順位（HTMLテキスト） */}
      <span className="w-10 shrink-0 text-center">
        <span className="sr-only">順位</span>
        <span className="text-base font-bold tabular-nums text-slate-900">
          {rank}
        </span>
        <span className="ml-0.5 text-[10px] text-slate-400">位</span>
      </span>

      {/* アバター or 代替アイコン */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <User className="h-5 w-5" aria-hidden="true" />
        )}
      </span>

      {/* ニックネーム（+ 自身識別テキスト） */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-800">
          {nickname}
          {isSelf ? (
            <>
              {/* 視覚表示用バッジ */}
              <span
                aria-hidden="true"
                className="ml-1.5 inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >
                あなた
              </span>
              {/* 音声読み上げ用の識別テキスト */}
              <span className="sr-only">（あなた）</span>
            </>
          ) : null}
        </span>
      </span>

      {/* GRANレベル（HTMLテキスト） */}
      <span className="shrink-0 text-right">
        <span className="sr-only">GRANレベル</span>
        <span className="text-base font-bold tabular-nums text-emerald-700">
          {granLevel}
        </span>
      </span>
    </li>
  );
}
