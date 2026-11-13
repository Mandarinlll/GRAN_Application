"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartPointDto } from "../../types/dto";
import { dateTicks, niceTicks, paddedLevelRange } from "../../utils/chartAxis";
import { NOTE_CLASS, formatDateTime } from "./shared";

const H = 280;
const MIN_W = 280;
const DEFAULT_W = 640;
const MARGIN_L = 44; // y軸ラベル用
const MARGIN_R = 20;
const MARGIN_T = 16;
const MARGIN_B = 40; // x軸ラベル用
const HIT_R = 22; // 透明な当たり判定（44px 相当以上）
const DAY_MS = 86_400_000;
const LABEL_CLASS = "fill-slate-700 dark:fill-slate-300";

function toTime(s: string): number {
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isNaN(t) ? 0 : t;
}

function dayStart(date: string): number {
  const t = Date.parse(`${date}T00:00:00`);
  return Number.isNaN(t) ? 0 : t;
}

/** 自前SVGの折れ線グラフ。縦軸・横軸・水平補助線付き。点はフォーカス・選択可能。 */
export function GranChart({ points }: { points: ChartPointDto[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(DEFAULT_W);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(MIN_W, Math.round(el.clientWidth) || DEFAULT_W));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) return null;

  const W = width;
  const plotW = W - MARGIN_L - MARGIN_R;
  const plotH = H - MARGIN_T - MARGIN_B;

  const times = points.map((p) => toTime(p.recordedAt));
  const levels = points.map((p) => p.postLevel);
  const lMin = Math.min(...levels);
  const lMax = Math.max(...levels);
  const { lo, hi } = paddedLevelRange(lMin, lMax);
  const yAxis = niceTicks(lo, hi, 5, { floor: 100, ceil: 999 });
  const ySpan = yAxis.max - yAxis.min || 1;

  const dates = points.map((p) => p.recordedAt.slice(0, 10));
  const distinct = new Set(dates).size;
  const wantCount = W < 420 ? 3 : W < 560 ? 4 : 5;
  const maxCount = distinct < 3 ? distinct : Math.min(wantCount, distinct);
  const xTicks = dateTicks(dates, maxCount);
  const sortedDates = Array.from(new Set(dates)).sort();
  const t0 = dayStart(sortedDates[0]);
  const t1 = dayStart(sortedDates[sortedDates.length - 1]) + DAY_MS;
  const tSpan = t1 - t0 || 1;
  const xOf = (t: number) => MARGIN_L + ((t - t0) / tSpan) * plotW;
  const yOf = (v: number) => MARGIN_T + plotH - ((v - yAxis.min) / ySpan) * plotH;

  const xs = times.map(xOf);
  const ys = levels.map(yOf);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const sel = selected !== null ? points[selected] : null;
  return (
    <div ref={wrapRef} className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="GRANレベル推移グラフ"
        className="h-auto w-full text-emerald-600 dark:text-emerald-400"
      >
        {yAxis.ticks.map((v) => (
          <g key={`y-${v}`}>
            <line
              data-gridline
              x1={MARGIN_L}
              x2={W - MARGIN_R}
              y1={yOf(v)}
              y2={yOf(v)}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth={1}
            />
            <text x={MARGIN_L - 6} y={yOf(v)} textAnchor="end" dominantBaseline="middle" fontSize={12} className={LABEL_CLASS}>
              {v}
            </text>
          </g>
        ))}
        <line x1={MARGIN_L} x2={MARGIN_L} y1={MARGIN_T} y2={MARGIN_T + plotH} className="stroke-slate-400 dark:stroke-slate-500" />
        <line x1={MARGIN_L} x2={W - MARGIN_R} y1={MARGIN_T + plotH} y2={MARGIN_T + plotH} className="stroke-slate-400 dark:stroke-slate-500" />
        {xTicks.map((t) => {
          const x = xOf(dayStart(t.date));
          return (
            <g key={`x-${t.date}`}>
              <line x1={x} x2={x} y1={MARGIN_T + plotH} y2={MARGIN_T + plotH + 4} className="stroke-slate-400 dark:stroke-slate-500" />
              <text x={x} y={MARGIN_T + plotH + 8} textAnchor="middle" dominantBaseline="hanging" fontSize={12} className={LABEL_CLASS}>
                {t.label}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
        {points.map((p, i) => {
          const isSel = selected === i;
          return (
            <g
              key={`${p.recordedAt}-${i}`}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={`${formatDateTime(p.recordedAt)} ${p.tournamentTitle} 変動後レベル ${p.postLevel}`}
              onClick={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(i);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible_.ring]:opacity-100"
            >
              <circle cx={xs[i]} cy={ys[i]} r={HIT_R} fill="transparent" />
              <circle
                className="ring opacity-0"
                cx={xs[i]}
                cy={ys[i]}
                r={10}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              />
              <circle
                cx={xs[i]}
                cy={ys[i]}
                r={isSel ? 6 : 4}
                fill={isSel ? "currentColor" : "white"}
                stroke="currentColor"
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>

      <p className={NOTE_CLASS}>
        {formatDateTime(points[0].recordedAt)} 〜 {formatDateTime(points[points.length - 1].recordedAt)}
        ／ レベル {lMin} 〜 {lMax}
      </p>

      <p className="min-h-[2.5rem] text-sm" aria-live="polite">
        {sel
          ? `${formatDateTime(sel.recordedAt)}　${sel.tournamentTitle}　変動後レベル ${sel.postLevel}`
          : "グラフの点を選択すると詳細が表示されます。"}
      </p>
    </div>
  );
}


