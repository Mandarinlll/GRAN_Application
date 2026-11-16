// エントリー済み大会をカレンダー（月表示）で見せるコンポーネント。
// 日付内の大会をタップすると、詳細モーダルを開く。
"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TournamentDetailHost } from "@/features/tournaments/components/TournamentDetailHost";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { EntryViewer } from "@/features/entries/server/entryViewData";
import type { EntrySummary } from "@/features/entries/types/entry";

type Props = {
  entries: EntrySummary[]; // 表示するエントリー（個人・チーム統合済み）
  tournaments: TournamentCardData[]; // 詳細表示用の大会データ
  viewer: EntryViewer;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// "YYYY-MM-DD" → "YYYY-MM"（タイムゾーンずれを避けるため文字列で扱う）
function monthKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export function EntryCalendar({ entries, tournaments, viewer }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  // 詳細表示中の大会（tournaments 内の位置）と、選んだエントリー。
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [focusEntryId, setFocusEntryId] = useState<string | null>(null);

  // 前後送りの対象は、エントリー済みの大会だけにする。
  const entered = useMemo(() => {
    const ids = new Set(entries.map((e) => e.tournamentId));
    return tournaments.filter((t) => ids.has(t.id));
  }, [entries, tournaments]);

  const openDetail = (e: EntrySummary) => {
    const i = entered.findIndex((t) => t.id === e.tournamentId);
    if (i < 0) return;
    setFocusEntryId(e.entryId);
    setDetailIndex(i);
  };

  // 日付文字列 → その日のエントリー一覧
  const byDate = useMemo(() => {
    const map = new Map<string, EntrySummary[]>();
    for (const e of entries) {
      const key = e.eventDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const prefix = monthKey(year, month0);
  const monthCount = entries.filter((e) => e.eventDate.startsWith(prefix)).length;

  // 月の1日の曜日と日数から、グリッドのセル（空白 + 日付）を作る
  const firstWeekday = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const goMonth = (delta: number) => {
    const d = new Date(year, month0 + delta, 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth0(today.getMonth());
  };
  const todayKey = `${monthKey(today.getFullYear(), today.getMonth())}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">
          カレンダー
        </h3>
        <button
          type="button"
          onClick={goToday}
          className="px-3 min-h-[36px] rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
        >
          今日
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 月切替ヘッダー */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="前の月"
            className="w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-900 tabular-nums">
              {year}年{month0 + 1}月
            </div>
            <div className="text-[11px] text-slate-500">
              この月のエントリー {monthCount}件
            </div>
          </div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="次の月"
            className="w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 曜日行 */}
        <div className="grid grid-cols-7 text-center text-[11px] font-bold border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                "py-1.5",
                i === 0 && "text-rose-500",
                i === 6 && "text-sky-600",
                i !== 0 && i !== 6 && "text-slate-500",
              )}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`blank-${idx}`}
                  className="min-h-[72px] sm:min-h-[96px] border-b border-r border-slate-100 bg-slate-50/50"
                />
              );
            }
            const key = `${prefix}-${String(day).padStart(2, "0")}`;
            const dayEntries = byDate.get(key) ?? [];
            const col = idx % 7;
            return (
              <div
                key={key}
                className="min-h-[72px] sm:min-h-[96px] border-b border-r border-slate-100 p-1 space-y-0.5"
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums",
                    key === todayKey
                      ? "bg-emerald-600 text-white"
                      : col === 0
                        ? "text-rose-500"
                        : col === 6
                          ? "text-sky-600"
                          : "text-slate-700",
                  )}
                >
                  {day}
                </div>
                {dayEntries.map((e) => (
                  <button
                    key={e.entryId}
                    type="button"
                    onClick={() => openDetail(e)}
                    title={e.tournamentTitle}
                    className={cn(
                      "block w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-bold leading-tight transition",
                      chipClass(e),
                    )}
                  >
                    {e.tournamentTitle}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <Legend className="bg-emerald-100 border-emerald-300" label="確定" />
        <Legend className="bg-amber-100 border-amber-300" label="キャンセル待ち / 要メンバー登録" />
        <Legend className="bg-slate-200 border-slate-300" label="終了" />
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-slate-500">
          まだエントリー済みの大会はありません。
        </p>
      )}

      <TournamentDetailHost
        tournaments={entered}
        index={detailIndex}
        onIndexChange={setDetailIndex}
        viewer={viewer}
        focusEntryId={focusEntryId}
      />
    </section>
  );
}

// カレンダー上の大会チップの色。
function chipClass(e: EntrySummary): string {
  if (e.kind === "WAITING" || (e.hasPendingMember && !e.isPast)) {
    return "bg-amber-100 text-amber-800 hover:bg-amber-200";
  }
  if (e.isPast || e.kind === "ATTENDED") {
    return "bg-slate-200 text-slate-600 hover:bg-slate-300";
  }
  return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("w-3 h-3 rounded border", className)} />
      {label}
    </span>
  );
}
