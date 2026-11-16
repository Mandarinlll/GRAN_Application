// チーム詳細画面のアイコン。画像が設定されていればクリックで拡大表示する（クライアント）。
// 画像未設定（頭文字表示）のときは拡大する対象が無いため、通常のアイコン表示のみ。
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TeamAvatar } from "@/features/teams/components/TeamAvatar";
import { teamAvatarSrc } from "@/features/teams/utils/avatarImage";

export function TeamAvatarViewer({
  teamId,
  name,
  avatarKey,
}: {
  teamId: string;
  name: string;
  avatarKey: string | null;
}) {
  const [open, setOpen] = useState(false);
  const src = teamAvatarSrc(teamId, avatarKey);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!src) {
    return <TeamAvatar teamId={teamId} name={name} avatarKey={avatarKey} size="lg" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${name}のアイコンを拡大表示`}
        className="rounded-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <TeamAvatar teamId={teamId} name={name} avatarKey={avatarKey} size="lg" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name}のアイコン`}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="拡大表示を閉じる"
            autoFocus
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${name}のアイコン`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl cursor-default"
          />
        </div>
      )}
    </>
  );
}
