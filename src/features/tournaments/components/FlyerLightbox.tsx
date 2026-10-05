// 要項写真の全画面ライトボックス（文字表示なし・写真のみ）。
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { FlyerPlaceholder } from "@/features/tournaments/components/FlyerPlaceholder";
import type { TournamentCardData } from "@/features/tournaments/types/view";

export function FlyerLightbox({
  tournament,
  onClose,
}: {
  tournament: TournamentCardData;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-2 sm:p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="全画面表示を閉じる"
        className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="relative max-h-[90vh] max-w-[calc(90vh*9/16)] w-full aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {tournament.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tournament.imageUrl}
            alt={`${tournament.title} の要項ポスター`}
            className="w-full h-full object-contain"
          />
        ) : (
          <FlyerPlaceholder tournament={tournament} />
        )}
      </div>
    </div>
  );
}
