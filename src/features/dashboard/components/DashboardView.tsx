// 管理ダッシュボード本体。上段に指標カード4枚、下段に折れ線グラフと積み上げ縦棒グラフ。
// グラフは依存追加を避けるため SVG で描画する。
import type { ReactNode } from "react";
import { formatYen } from "@/utils/date";
import type { DashboardData } from "../types/dashboard";

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-h-[300px] min-w-0 flex-col bg-white border border-slate-200 rounded-xl p-4 lg:min-h-0">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

const W = 480;
const H = 240;
const PAD = { top: 12, right: 20, bottom: 32, left: 32 };

// 最大値から見やすい目盛り上限を決める。
function niceMax(max: number): number {
  if (max <= 5) return 5;
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}

function Axis({ max, ticks = 5 }: { max: number; ticks?: number }) {
  const ih = H - PAD.top - PAD.bottom;
  return (
    <>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * i;
        const y = PAD.top + ih - (v / max) * ih;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function md(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function TrendChart({ data }: { data: DashboardData["trend"] }) {
  const max = niceMax(Math.max(...data.map((p) => p.count), 0));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const points = data.map((p, i) => `${x(i)},${y(p.count)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="min-h-0 w-full flex-1" role="img" aria-label="日別エントリー数の推移">
      <Axis max={max} />
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" />
      {data.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.count)} r="3" fill="#2563eb">
            <title>{`${p.date}: ${p.count}件`}</title>
          </circle>
          {i % 2 === 0 || i === data.length - 1 ? (
            <text x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="#64748b">
              {md(p.date)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

const SERIES = [
  { key: "entries", label: "エントリー数", color: "#2563eb" },
  { key: "vacant", label: "空き枠", color: "#e2e8f0" },
] as const;

// 棒の高さは募集枠。下段がエントリー数、上段が空き枠。上に「エントリー数/枠（充足率）」を表示する。
function StackedBars({ data }: { data: DashboardData["tournaments"] }) {
  if (data.length === 0) return <p className="text-sm text-slate-500">大会がありません。</p>;
  const rows = data.map((t) => ({
    ...t,
    vacant: Math.max(t.capacity - t.entries, 0),
    rate: t.capacity > 0 ? Math.round((t.entries / t.capacity) * 100) : 0,
  }));
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.capacity, r.entries)), 0));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom - 14;
  const top = PAD.top + 14;
  const slot = iw / rows.length;
  const bw = Math.min(28, slot * 0.6);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-h-0 w-full flex-1" role="img" aria-label="直近の大会ごとのエントリー数と募集枠">
        {Array.from({ length: 6 }, (_, i) => {
          const v = (max / 5) * i;
          const y = top + ih - (v / max) * ih;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {Number.isInteger(v) ? v : v.toFixed(1)}
              </text>
            </g>
          );
        })}
        {rows.map((r, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const hEntries = (r.entries / max) * ih;
          const hVacant = (r.vacant / max) * ih;
          const yEntries = top + ih - hEntries;
          const yVacant = yEntries - hVacant;
          return (
            <g key={r.id}>
              {r.entries > 0 && (
                <rect x={cx - bw / 2} y={yEntries} width={bw} height={hEntries} fill={SERIES[0].color}>
                  <title>{`${r.title} エントリー数: ${r.entries}件`}</title>
                </rect>
              )}
              {r.vacant > 0 && (
                <rect x={cx - bw / 2} y={yVacant} width={bw} height={hVacant} fill={SERIES[1].color}>
                  <title>{`${r.title} 空き枠: ${r.vacant}`}</title>
                </rect>
              )}
              <text x={cx} y={yVacant - 4} textAnchor="middle" fontSize="9" fill="#334155">
                {r.rate}%
              </text>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="10" fill="#64748b">
                {md(r.eventDate)}
                <title>{`${r.title}（${r.entries}/${r.capacity}）`}</title>
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
        <li>数値は募集枠に対するエントリー数の割合</li>
      </ul>
    </>
  );
}
export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-2.75rem-3rem)]">
      <h1 className="text-lg font-bold text-slate-900">ダッシュボード</h1>
      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="今日のエントリー数" value={data.todayEntries.toLocaleString("ja-JP")} unit="件" />
        <StatCard label="今月の売上予定" value={formatYen(data.monthlySales)} />
        <StatCard label="公開中の大会数" value={data.openTournaments.toLocaleString("ja-JP")} unit="件" />
        <StatCard label="要対応タスク" value={data.pendingTasks.toLocaleString("ja-JP")} unit="件" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-1">
        <Panel title="エントリー数（グラフ）">
          <TrendChart data={data.trend} />
        </Panel>
        <Panel title="直近10大会のエントリー状況">
          <StackedBars data={data.tournaments} />
        </Panel>
      </div>
    </div>
  );
}
