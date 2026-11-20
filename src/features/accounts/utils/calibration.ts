import type { DeclaredClass } from "@/types/user";

// 申告階級ごとの査定レンジ [min, max]。auth/utils/level.ts は Math.round のため別に持つ。
export const CALIBRATION_RANGE: Record<DeclaredClass, readonly [number, number]> = {
  A: [850, 999],
  AB: [750, 870],
  B: [650, 770],
  BC: [550, 670],
  C: [450, 570],
  CD: [350, 470],
  D: [250, 370],
  DE: [100, 270],
};

// 中央値（切り捨て）。A は 924。
export function calibrationMidpoint(c: DeclaredClass): number {
  const [min, max] = CALIBRATION_RANGE[c];
  return Math.floor((min + max) / 2);
}

export function isOutOfRange(c: DeclaredClass, level: number): boolean {
  const [min, max] = CALIBRATION_RANGE[c];
  return level < min || level > max;
}

// 100〜999 の整数のみ受け付ける。空欄・小数・非数値は null。
export function parseGranLevel(input: unknown): number | null {
  let n: number;
  if (typeof input === "number") {
    n = input;
  } else if (typeof input === "string") {
    const s = input.trim();
    if (!/^\d+$/.test(s)) return null;
    n = Number(s);
  } else {
    return null;
  }
  if (!Number.isInteger(n) || n < 100 || n > 999) return null;
  return n;
}
