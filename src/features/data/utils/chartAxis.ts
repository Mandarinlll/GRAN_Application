// GranChart の軸計算（描画から独立した純粋関数）

export interface NiceTicks {
  ticks: number[];
  min: number;
  max: number;
  step: number;
}

export interface DateTick {
  date: string; // YYYY-MM-DD
  label: string;
}

/** 1・2・5 × 10^k の系列で step の1段階下を返す（最小 1）。 */
function smallerStep(step: number): number {
  if (step <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(step)));
  const m = Math.round(step / exp);
  if (m === 5) return 2 * exp;
  if (m === 2) return exp;
  return 5 * (exp / 10); // m === 1
}

/** raw 以上となる最小の 1・2・5 × 10^k（最小 1）。 */
function stepAtLeast(raw: number): number {
  if (!(raw > 1)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) {
    if (m * exp >= raw) return m * exp;
  }
  return 10 * exp;
}

function build(dataMin: number, dataMax: number, step: number): number[] {
  const min = Math.floor(dataMin / step) * step;
  const max = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  return ticks;
}

export function niceTicks(dataMin: number, dataMax: number, targetCount = 5): NiceTicks {
  const lo = Math.min(dataMin, dataMax);
  const hi = Math.max(dataMin, dataMax);
  const intervals = Math.max(1, targetCount - 1);
  let step = stepAtLeast((hi - lo) / intervals);
  let ticks = build(lo, hi, step);

  while (ticks.length < 3 && step > 1) {
    step = smallerStep(step);
    ticks = build(lo, hi, step);
  }

  if (ticks.length < 3) {
    // step=1 でも足りない（範囲が 0 または 1）
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    if (ticks.length === 1) {
      ticks = [first - 1, first, first + 1];
    } else {
      // 2個: データ範囲を含んだまま上側に1つ追加
      ticks = [first, last, last + 1];
    }
    step = 1;
  }

  return { ticks, min: ticks[0], max: ticks[ticks.length - 1], step };
}

export function dateTicks(dates: string[], maxCount = 5): DateTick[] {
  const unique = Array.from(new Set(dates)).sort();
  const n = unique.length;
  if (n === 0) return [];

  let picked: string[];
  if (n <= maxCount) {
    picked = unique;
  } else if (maxCount <= 1) {
    picked = [unique[0]];
  } else {
    const idx = new Set<number>();
    for (let i = 0; i < maxCount; i++) {
      idx.add(Math.round((i * (n - 1)) / (maxCount - 1)));
    }
    picked = Array.from(idx)
      .sort((a, b) => a - b)
      .map((i) => unique[i]);
  }

  const sameYear = unique.every((d) => d.slice(0, 4) === unique[0].slice(0, 4));
  return picked.map((date) => {
    const [y, m, d] = date.split("-");
    const label = sameYear ? `${Number(m)}/${Number(d)}` : `${y}/${m}/${d}`;
    return { date, label };
  });
}
