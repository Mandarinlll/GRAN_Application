"use client";

import { useState } from "react";
import type { ChartPointDto } from "../../types/dto";
import { NOTE_CLASS, formatDateTime } from "./shared";

const W = 640;
const H = 240;
const PAD_X = 24;
const PAD_Y = 24;
const HIT_R = 22; // 透明な当たり判定（44px 相当以上）

function toTime(s: string): number {
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isNaN(t) ? 0 : t;
}

/** 自前SVGの折れ線グラフ。点はフォーカス・選択可能で、全値は表でも確認できる。 */
export function GranChart({ points }: { points: ChartPointDto[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (points.length < 2) return null;

  const times = points.map((p) => toTime(p.recordedAt));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const levels = points.map((p) => p.postLevel);
  const lMin = Math.min(...levels);
  const lMax = Math.max(...levels);
  const lSpan = lMax - lMin || 1;

  const xs = points.map((_, i) =>
    tMax === tMin
      ? PAD_X + (i * (W - PAD_X * 2)) / (points.length - 1)
      : PAD_X + ((times[i] - tMin) / (tMax - tMin)) * (W - PAD_X * 2),
  );
  const ys = points.map((p) => H - PAD_Y - ((p.postLevel - lMin) / lSpan) * (H - PAD_Y * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const sel = selected !== null ? points[selected] : null;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="GRANレベル推移グラフ"
        className="h-auto w-full text-emerald-600 dark:text-emerald-400"
      >
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

      <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <summary className="min-h-[44px] cursor-pointer text-sm font-bold leading-[44px]">
          グラフの全データを表で見る
        </summary>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th scope="col" className="py-1 pr-2">確定日時</th>
                <th scope="col" className="py-1 pr-2">大会名</th>
                <th scope="col" className="py-1 text-right">変動後</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={`${p.recordedAt}-${i}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1 pr-2 whitespace-nowrap tabular-nums">{formatDateTime(p.recordedAt)}</td>
                  <td className="py-1 pr-2">{p.tournamentTitle}</td>
                  <td className="py-1 text-right tabular-nums">{p.postLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
