// 「姓 名」形式で保存されている氏名/フリガナを姓と名へ分割・結合する補助関数。

export function splitName(full: string): { last: string; first: string } {
  const trimmed = full.trim();
  const idx = trimmed.search(/[\s　]/);
  if (idx < 0) return { last: trimmed, first: "" };
  return {
    last: trimmed.slice(0, idx),
    first: trimmed.slice(idx + 1).trim(),
  };
}

export function joinName(last: string, first: string): string {
  return `${last.trim()} ${first.trim()}`;
}
