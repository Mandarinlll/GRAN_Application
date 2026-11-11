export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

// 春3–5 / 夏6–8 / 秋9–11 / 冬12–2
export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  if (month >= 9 && month <= 11) return "AUTUMN";
  return "WINTER";
}

// "YYYY-MM-DD"（先頭10文字のみ参照。日時文字列も可）
export function seasonOfDate(eventDate: string): Season {
  return seasonOf(Number(eventDate.slice(5, 7)));
}
