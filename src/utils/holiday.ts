// 日本の祝日判定（国民の祝日に関する法律に基づく計算。精度を保証する対象: 2007〜2099年）。
// 振替休日・国民の休日（祝日に挟まれた平日）を含む。
// 2020・2021年のオリンピック特例（海の日・スポーツの日・山の日の移動）にも対応する。

// 春分日・秋分日（1980〜2099年の近似式）。
function equinoxDay(year: number, kind: "spring" | "autumn"): number {
  const base = kind === "spring" ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// month(1-12) の第 n 月曜日の日付。
function nthMonday(year: number, month: number, n: number): number {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((8 - firstDow) % 7) + (n - 1) * 7;
}

const cache = new Map<number, Map<string, string>>();

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// その年の祝日（YYYY-MM-DD）の集合。
function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;

  const base: [number, number, string][] = [];
  const add = (m: number, d: number, name: string) => base.push([m, d, name]);

  add(1, 1, "元日");
  add(1, nthMonday(year, 1, 2), "成人の日");
  if (year >= 1967) add(2, 11, "建国記念の日");
  if (year >= 2020) add(2, 23, "天皇誕生日");
  add(3, equinoxDay(year, "spring"), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");

  // 海の日・スポーツの日（2020・2021年は五輪特例で移動）。
  if (year === 2020) {
    add(7, 23, "海の日");
    add(7, 24, "スポーツの日");
  } else if (year === 2021) {
    add(7, 22, "海の日");
    add(7, 23, "スポーツの日");
  } else {
    add(7, nthMonday(year, 7, 3), "海の日");
    add(10, nthMonday(year, 10, 2), "スポーツの日");
  }

  // 山の日（2016〜。2020年8/10、2021年8/8に移動）。
  if (year >= 2016) {
    add(8, year === 2020 ? 10 : year === 2021 ? 8 : 11, "山の日");
  }

  add(9, nthMonday(year, 9, 3), "敬老の日");
  add(9, equinoxDay(year, "autumn"), "秋分の日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  const set = new Map<string, string>(base.map(([m, d, name]) => [key(year, m, d), name]));

  // 国民の休日: 前後が祝日の平日（敬老の日と秋分の日の間など）。
  for (const [m, d] of base) {
    const next = new Date(year, m - 1, d + 2);
    const mid = new Date(year, m - 1, d + 1);
    if (
      next.getFullYear() === year &&
      mid.getDay() !== 0 &&
      !set.has(key(year, mid.getMonth() + 1, mid.getDate())) &&
      set.has(key(year, next.getMonth() + 1, next.getDate()))
    ) {
      set.set(key(year, mid.getMonth() + 1, mid.getDate()), "国民の休日");
    }
  }

  // 振替休日: 日曜の祝日の翌日以降、最初の祝日でない日。
  for (const k of [...set.keys()]) {
    const [y, m, d] = k.split("-").map(Number);
    if (new Date(y, m - 1, d).getDay() !== 0) continue;
    const sub = new Date(y, m - 1, d + 1);
    while (set.has(key(sub.getFullYear(), sub.getMonth() + 1, sub.getDate()))) {
      sub.setDate(sub.getDate() + 1);
    }
    set.set(key(sub.getFullYear(), sub.getMonth() + 1, sub.getDate()), "振替休日");
  }

  cache.set(year, set);
  return set;
}

// 祝日名（祝日でなければ null。month は 1-12）。
export function getJapaneseHolidayName(
  year: number,
  month: number,
  day: number,
): string | null {
  return holidaysOf(year).get(key(year, month, day)) ?? null;
}

// 祝日か（month は 1-12）。
export function isJapaneseHoliday(year: number, month: number, day: number): boolean {
  return getJapaneseHolidayName(year, month, day) !== null;
}

// 祝日ではないが季節行事として表示するイベント（固定日）。
const FIXED_EVENTS: Record<string, string> = {
  "2-3": "節分",
  "2-14": "バレンタイン",
  "3-3": "ひなまつり",
  "3-14": "ホワイトデー",
  "4-1": "エイプリルフール",
  "7-7": "七夕",
  "10-31": "ハロウィン",
  "12-24": "クリスマスイブ",
  "12-25": "クリスマス",
  "12-31": "大晦日",
};

// 第 n 日曜日の日付。
function nthSunday(year: number, month: number, n: number): number {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

// イベント名（なければ null。month は 1-12）。
export function getEventName(year: number, month: number, day: number): string | null {
  const fixed = FIXED_EVENTS[`${month}-${day}`];
  if (fixed) return fixed;
  if (month === 5 && day === nthSunday(year, 5, 2)) return "母の日";
  if (month === 6 && day === nthSunday(year, 6, 3)) return "父の日";
  return null;
}