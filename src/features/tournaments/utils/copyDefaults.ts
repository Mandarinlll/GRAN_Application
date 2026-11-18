// コピー作成画面の初期値（純粋関数）。
// コピー対象項目のみ引き継ぎ、開催日・開始/終了時刻・受付開始/締切は空にする。
// short_title と draw_pdf_url は引き継がない。

import type { AdminTournament } from "../types/adminTournament";
import type { TournamentCategory, TournamentTier } from "../types/tournament";

export interface CopyDefaults {
  title: string;
  category: TournamentCategory;
  tier: TournamentTier;
  venue: string;
  courtInfo: string | null;
  description: string | null;
  prize: string | null;
  capacity: number;
  entryFee: number;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  alertThreshold: number | null;
  surface: AdminTournament["surface"];
  seriesId: string | null;
  genderDivision: AdminTournament["genderDivision"];
  imageUrl: string | null;
  eventDate: "";
  startTime: "";
  endTime: "";
  entryStartAt: "";
  entryEndAt: "";
}

export function buildCopyDefaults(source: AdminTournament): CopyDefaults {
  return {
    title: source.title,
    category: source.category,
    tier: source.tier,
    venue: source.venue,
    courtInfo: source.courtInfo,
    description: source.description,
    prize: source.prize,
    capacity: source.capacity,
    entryFee: source.entryFee,
    teamSizeMin: source.teamSizeMin,
    teamSizeMax: source.teamSizeMax,
    alertThreshold: source.alertThreshold,
    surface: source.surface,
    seriesId: source.seriesId,
    genderDivision: source.genderDivision,
    imageUrl: source.imageUrl,
    eventDate: "",
    startTime: "",
    endTime: "",
    entryStartAt: "",
    entryEndAt: "",
  };
}
