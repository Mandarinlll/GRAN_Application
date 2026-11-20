import { randomInt } from "node:crypto";

// 紛らわしい文字（0/O、1/l/I）を除く
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = LETTERS + DIGITS;
const LENGTH = 14;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

/** 14 文字の英数字。英字と数字を各 1 文字以上含む。 */
export function generateInitialPassword(): string {
  const chars: string[] = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < LENGTH) chars.push(pick(ALL));
  // Fisher-Yates シャッフル（暗号論的乱数）
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
