import type { TournamentCategory } from "@/features/tournaments/types/tournament";
import type { GenderDivision, Surface } from "../types/dto";
import { seasonOfDate, type Season } from "./season";

export type Dimension =
  | "category"
  | "venue"
  | "surface"
  | "season"
  | "opponent"
  | "series";

// 勝者が確定した FINISHED 試合（ユーザー視点）
export interface DecidedMatch {
  matchId: string;
  isWin: boolean;
  tournamentCategory: TournamentCategory;
  genderDivision: GenderDivision | null;
  venue: string;
  surface: Surface | null;
  seriesName: string | null;
  eventDate: string;
  opponentTeamName: string | null; // 団体戦のみ非null
}

export interface Bucket {
  key: string;
  label: string;
  matches: number;
  wins: number;
  losses: number;
}

export const UNSET_KEY = "UNSET";
export const UNSET_LABEL = "未設定";

const DIVISION_LABEL: Record<GenderDivision, string> = {
  MEN: "男子",
  WOMEN: "女子",
  MIXED: "混合",
};
const DIVISION_ORDER: GenderDivision[] = ["MEN", "WOMEN", "MIXED"];

const SURFACE_LABEL: Record<Surface, string> = {
  HARD: "ハード",
  CLAY: "クレー",
  ARTIFICIAL_GRASS: "人工芝",
  OTHER: "その他",
};

const SEASON_LABEL: Record<Season, string> = {
  SPRING: "春",
  SUMMER: "夏",
  AUTUMN: "秋",
  WINTER: "冬",
};
const SEASON_ORDER: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

// 団体戦カテゴリは部門が確定。それ以外は gender_division を参照。判定不能は null
function divisionOf(m: DecidedMatch): GenderDivision | null {
  switch (m.tournamentCategory) {
    case "MEN_TEAM":
      return "MEN";
    case "WOMEN_TEAM":
      return "WOMEN";
    case "MIX_TEAM":
      return "MIXED";
    default:
      return m.genderDivision;
  }
}

function emptyBucket(key: string, label: string): Bucket {
  return { key, label, matches: 0, wins: 0, losses: 0 };
}

function add(map: Map<string, Bucket>, key: string, label: string, isWin: boolean) {
  let b = map.get(key);
  if (!b) {
    b = emptyBucket(key, label);
    map.set(key, b);
  }
  b.matches += 1;
  if (isWin) b.wins += 1;
  else b.losses += 1;
}

// 動的区分: 試合数降順 → ラベル昇順。「未設定」は末尾
function sortDynamic(buckets: Bucket[]): Bucket[] {
  return buckets.sort((a, b) => {
    const au = a.key === UNSET_KEY ? 1 : 0;
    const bu = b.key === UNSET_KEY ? 1 : 0;
    if (au !== bu) return au - bu;
    if (b.matches !== a.matches) return b.matches - a.matches;
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
}

export function aggregateByDimension(
  matches: DecidedMatch[],
  dim: Dimension,
): Bucket[] {
  const map = new Map<string, Bucket>();

  switch (dim) {
    case "category": {
      for (const m of matches) {
        const d = divisionOf(m);
        // 部門を判別できない試合は種目集計から除外（「未設定」区分は作らない）
        if (d) add(map, d, DIVISION_LABEL[d], m.isWin);
      }
      return DIVISION_ORDER.map(
        (d) => map.get(d) ?? emptyBucket(d, DIVISION_LABEL[d]),
      );
    }
    case "season": {
      for (const m of matches) {
        const s = seasonOfDate(m.eventDate);
        add(map, s, SEASON_LABEL[s], m.isWin);
      }
      return SEASON_ORDER.map(
        (s) => map.get(s) ?? emptyBucket(s, SEASON_LABEL[s]),
      );
    }
    case "venue": {
      for (const m of matches) {
        const v = m.venue?.trim();
        // 空の会場名は会場別集計から除外
        if (v) add(map, v, v, m.isWin);
      }
      return sortDynamic([...map.values()]);
    }
    case "surface": {
      for (const m of matches) {
        if (m.surface) add(map, m.surface, SURFACE_LABEL[m.surface], m.isWin);
        else add(map, UNSET_KEY, UNSET_LABEL, m.isWin);
      }
      return sortDynamic([...map.values()]);
    }
    case "series": {
      for (const m of matches) {
        const s = m.seriesName?.trim();
        if (s) add(map, s, s, m.isWin);
        else add(map, UNSET_KEY, UNSET_LABEL, m.isWin);
      }
      return sortDynamic([...map.values()]);
    }
    case "opponent": {
      for (const m of matches) {
        if (m.opponentTeamName == null) continue; // 団体戦のみ
        add(map, m.opponentTeamName, m.opponentTeamName, m.isWin);
      }
      return sortDynamic([...map.values()]);
    }
  }
}
