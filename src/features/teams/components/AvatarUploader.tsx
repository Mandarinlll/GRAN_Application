// 代表者向け: チームアイコンの設定・差し替え・削除（クライアント）。
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_AVATAR_BYTES } from "@/features/teams/utils/avatarImage";

const BTN =
  "min-h-[44px] px-4 rounded-xl text-xs font-bold inline-flex items-center transition disabled:opacity-60";

export function AvatarUploader({
  teamId,
  hasAvatar,
}: {
  teamId: string;
  hasAvatar: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/teams/${encodeURIComponent(teamId)}/avatar`;

  function request(init: RequestInit) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(endpoint, init);
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        if (!res.ok) setError(body?.message ?? "処理に失敗しました。");
      } catch {
        setError("通信に失敗しました。");
      }
      router.refresh();
    });
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError("画像は2MB以下にしてください。");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    request({ method: "POST", body: form });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onSelect}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className={`${BTN} border border-slate-200 text-slate-700 hover:bg-slate-50`}
        >
          {hasAvatar ? "アイコンを変更" : "アイコンを設定"}
        </button>
        {hasAvatar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("アイコンを削除しますか？")) request({ method: "DELETE" });
            }}
            className={`${BTN} border border-rose-200 text-rose-600 hover:bg-rose-50`}
          >
            削除
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">PNG・JPEG・WebP / 2MBまで</p>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
