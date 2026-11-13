// Chart_Tooltip の位置計算。DOMに依存しない純粋関数。

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TooltipPlacement {
  left: number;
  top: number;
  placement: "above" | "below";
}

function clamp(v: number, min: number, max: number): number {
  // max < min（実寸が領域を超える）場合は min に固定する。
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}

export function tooltipPosition(args: {
  anchor: { x: number; y: number };
  size: { width: number; height: number };
  bounds: Rect;
  gap?: number;
}): TooltipPlacement {
  const { anchor, size, bounds, gap = 12 } = args;

  const left = clamp(anchor.x - size.width / 2, bounds.left, bounds.right - size.width);

  const above = anchor.y - gap - size.height;
  if (above >= bounds.top) {
    return { left, top: above, placement: "above" };
  }
  const below = anchor.y + gap;
  if (below + size.height <= bounds.bottom) {
    return { left, top: below, placement: "below" };
  }
  return {
    left,
    top: clamp(below, bounds.top, bounds.bottom - size.height),
    placement: "below",
  };
}
