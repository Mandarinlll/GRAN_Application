// 自チーム申込中・エントリー済み大会一覧モーダル（マイスケジュール）。
// 「自分（個人）」と「チーム」をタブで分け、さらに状態（確定/キャンセル待ち/過去）で絞り込む。
"use client";

import { useMemo, useState } from "react";
import { X, Bookmark, Calendar, MapPin, Clock, AlertCircle, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TierBadge, CategoryBadge } from "@/features/tournaments/components/badges";
import { formatEventDate, formatYen } from "@/utils/date";
import type { EntrySummary } from "@/features/entries/types/entry";

type ScopeTab = "personal" | "team";
type StateTab = "all" | "confirmed" | "waitlist" | "past";

type Props = {
  personal: EntrySummary[];
  team: EntrySummary[];
  teamName: string | null;
  onClose: () => void;
  onCancel: (entry: EntrySummary) => void;
  onEditMembers: (entry: EntrySummary) => void;
};

export function EnteredTournamentsModal({
  personal,
  team,
  teamName,
  onClose,
  onCancel,
  onEditMembers,
}: Props) {
  const [scope, setScope] = useState<ScopeTab>(
    team.length > 0 ? "team" : "personal",
  );
  const [stateTab, setStateTab] = useState<StateTab>("all");

  const source = scope === "team" ? team : personal;

  const filtered = useMemo(() => {
    return source.filter((e) => {
      if (stateTab === "confirmed") return e.kind === "CONFIRMED" && !e.isPast;
      if (stateTab === "waitlist") return e.kind === "WAITING";
      if (stateTab === "past") return e.isPast || e.kind === "ATTENDED";
      return true;
    });
  }, [source, stateTab]);

  const counts = useMemo(
    () => ({
      all: source.length,
      confirmed: source.filter((e) => e.kind === "CONFIRMED" && !e.isPast).length,
      waitlist: source.filter((e) => e.kind === "WAITING").length,
      past: source.filter((e) => e.isPast || e.kind === "ATTENDED").length,
    }),
    [source],
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
              <Bookmark className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">
                申込中・エントリー済み大会
              </h3>
              {teamName && (
                <div className="text-xs text-purple-300 truncate">
                  {teamName}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 個人/チーム 切替タブ */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 pt-2.5 flex items-center gap-2">
          <ScopeTabBtn
            active={scope === "personal"}
            onClick={() => setScope("personal")}
            label={`自分（個人） (${personal.length})`}
          />
          <ScopeTabBtn
            active={scope === "team"}
            onClick={() => setScope("team")}
            disabled={!teamName}
            label={`チーム (${team.length})`}
          />
        </div>

        {/* 状態フィルタタブ */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <StateTabBtn active={stateTab === "all"} onClick={() => setStateTab("all")} label={`すべて (${counts.all})`} />
          <StateTabBtn active={stateTab === "confirmed"} onClick={() => setStateTab("confirmed")} label={`確定中 (${counts.confirmed})`} />
          <StateTabBtn active={stateTab === "waitlist"} onClick={() => setStateTab("waitlist")} label={`キャンセル待ち (${counts.waitlist})`} />
          <StateTabBtn active={stateTab === "past"} onClick={() => setStateTab("past")} label={`終了・履歴 (${counts.past})`} />
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              該当するエントリーはありません。
            </div>
          ) : (
            filtered.map((e) => (
              <EntryRow
                key={e.entryId}
                entry={e}
                onCancel={() => onCancel(e)}
                onEditMembers={() => onEditMembers(e)}
              />
            ))
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {scope === "team" ? "チーム" : "個人"}: 合計 {source.length}件
          </span>
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScopeTabBtn({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 min-h-[40px] rounded-t-lg text-xs font-bold transition border-b-2",
        active
          ? "text-purple-700 border-purple-600"
          : "text-slate-500 border-transparent hover:text-slate-800",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {label}
    </button>
  );
}

function StateTabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 min-h-[40px] rounded-xl text-xs font-bold transition shrink-0",
        active
          ? "bg-purple-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-200",
      )}
    >
      {label}
    </button>
  );
}

function EntryRow({
  entry,
  onCancel,
  onEditMembers,
}: {
  entry: EntrySummary;
  onCancel: () => void;
  onEditMembers: () => void;
}) {
  const isWaiting = entry.kind === "WAITING";
  const isCancelled = entry.kind === "CANCELLED";
  const canModify = entry.kind === "CONFIRMED" && !entry.isPast;

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <CategoryBadge category={entry.category} className="scale-90 origin-left" />
            <TierBadge tier={entry.tier} className="scale-90 origin-left" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {entry.tournamentTitle}
          </h4>
        </div>
        {/* 状態バッジ */}
        {isWaiting ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
            <Clock className="w-3 h-3" />#{entry.queueNumber}
          </span>
        ) : isCancelled ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
            キャンセル済
          </span>
        ) : entry.isPast ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
            終了
          </span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            確定
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="font-bold tabular-nums">
            {formatEventDate(entry.eventDate)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">{entry.venue}</span>
        </div>
      </div>

      {/* 未定枠の警告 */}
      {entry.hasPendingMember && canModify && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>未定枠があります。メンバーを登録してください。</span>
        </div>
      )}

      {/* アクション */}
      {canModify && (
        <div className="flex items-center gap-2 pt-1">
          {entry.isTeamEntry && (
            <button
              type="button"
              onClick={onEditMembers}
              className="flex items-center gap-1 px-3 min-h-[40px] rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              <Users2 className="w-3.5 h-3.5" />
              メンバー変更
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-3 min-h-[40px] rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
          >
            キャンセル申請
          </button>
        </div>
      )}
    </div>
  );
}
