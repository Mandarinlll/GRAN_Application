// 大会日程ページの親コンポーネント（クライアント）。
// フィルター・ビュー切替・一括選択・各種モーダル・トーストを統括する。
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListFilter, LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { useTournamentFilters } from "@/features/tournaments/hooks/useTournamentFilters";
import { ScheduleControls } from "@/features/tournaments/components/ScheduleControls";
import { ScheduleTable } from "@/features/tournaments/components/ScheduleTable";
import { ScheduleCards } from "@/features/tournaments/components/ScheduleCards";
import { TournamentDetailHost } from "@/features/tournaments/components/TournamentDetailHost";
import { BulkEntryBar } from "@/features/entries/components/BulkEntryBar";
import { BulkEntryModal } from "@/features/entries/components/BulkEntryModal";
import { CancelEntryModal } from "@/features/entries/components/CancelEntryModal";
import { EditMembersModal } from "@/features/entries/components/EditMembersModal";
import { EnteredTournamentsModal } from "@/features/entries/components/EnteredTournamentsModal";
import { getMyEntriesAction, type MyEntriesResult } from "@/features/entries/server/actions";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { EntryViewer } from "@/features/entries/server/entryViewData";
import type { EntrySummary } from "@/features/entries/types/entry";

type Props = {
  tournaments: TournamentCardData[];
  viewer: EntryViewer;
  unreadNotifications?: number;
  // 指定されたエントリーのメンバー変更モーダルを初期表示で開く（通知ページからの導線）。
  initialEditEntryId?: string | null;
  // 個人戦・団体戦のエントリー済み大会数（サーバー側で集計）。
  entryCounts: { personal: number; team: number };
};

type ViewMode = "table" | "cards";

export function TournamentSchedule({
  tournaments,
  viewer,
  unreadNotifications = 0,
  initialEditEntryId = null,
  entryCounts,
}: Props) {
  const router = useRouter();
  const { filters, update, reset, filtered, kpi } = useTournamentFilters(tournaments);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [toast, setToast] = useState<ToastState | null>(null);

  // 一括選択。
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // モーダル状態。
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // 申込中一覧から開いた詳細は、フィルター結果に含まれない大会もあるため単独リストで表示する。
  const [detailOverride, setDetailOverride] = useState<TournamentCardData[] | null>(null);
  const [detailFocusEntryId, setDetailFocusEntryId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  // 申込中一覧（遅延取得）。
  const [myEntries, setMyEntries] = useState<MyEntriesResult | null>(null);
  const [enteredOpen, setEnteredOpen] = useState(false);
  const [enteredScope, setEnteredScope] = useState<"personal" | "team" | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<EntrySummary | null>(null);
  const [editTarget, setEditTarget] = useState<EntrySummary | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 選択中の大会（フィルター後の全体から ID で解決）。
  const selectedTournaments = useMemo(
    () => tournaments.filter((t) => selectedIds.has(t.id)),
    [tournaments, selectedIds],
  );
  const selectedTotalFee = selectedTournaments.reduce(
    (sum, t) => sum + t.entryFee,
    0,
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const t of filtered) {
        const selectable =
          t.status === "OPEN" &&
          !t.isPast &&
          t.capacityStatus !== "FULL" &&
          !t.isEntered;
        if (!selectable) continue;
        if (checked) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });
  }

  // 申込中一覧を開く（サーバーから取得）。
  async function openEntered(scope?: "personal" | "team") {
    setEnteredScope(scope);
    const data = await getMyEntriesAction();
    setMyEntries(data);
    setEnteredOpen(true);
  }

  const shellUser = {
    realName: viewer.realName,
    nickname: viewer.nickname,
    granLevel: viewer.granLevel,
    avatarText: viewer.realName.charAt(0) || "?",
    teamName: viewer.team?.name ?? null,
    unreadNotifications,
  };

  return (
    <AppShell activeId="schedule" user={shellUser}>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 pb-24">
        {/* ページ見出し */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              大会日程・要項一覧
            </h1>
            <p className="text-xs text-slate-500">
              2026年度 公式ツアースケジュール・要項閲覧・エントリー
            </p>
          </div>
        </div>

        {/* KPI + フィルター */}
        <ScheduleControls
          kpi={{ open: kpi.open, few: kpi.few, ...entryCounts }}
          filters={filters}
          update={update}
          reset={reset}
          resultCount={filtered.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenEntered={(scope) => void openEntered(scope)}
        />

        {/* 一覧（表 or カード） */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {viewMode === "table"
                  ? "公式ツアースケジュール一覧表"
                  : "大会カード・要項サムネイル一覧"}
              </span>
            </h2>
            <span className="text-xs text-slate-400">
              {viewMode === "table"
                ? "行タップで要項を展開"
                : "カードタップで要項を展開"}
            </span>
          </div>

          {viewMode === "table" ? (
            <ScheduleTable
              tournaments={filtered}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onRowClick={(index) => setViewerIndex(index)}
              sortOrder={filters.sortOrder}
              onToggleSort={() =>
                update("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc")
              }
              onResetFilters={reset}
            />
          ) : (
            <ScheduleCards
              tournaments={filtered}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onCardClick={(index) => setViewerIndex(index)}
              onResetFilters={reset}
            />
          )}
        </section>
      </main>

      {/* 大会詳細（ホームのカレンダーと共通）＋エントリー等の操作 */}
      <TournamentDetailHost
        tournaments={detailOverride ?? filtered}
        index={viewerIndex}
        onIndexChange={(next) => {
          setViewerIndex(next);
          if (next === null) {
            setDetailOverride(null);
            setDetailFocusEntryId(null);
          }
        }}
        viewer={viewer}
        focusEntryId={detailFocusEntryId}
        initialEditEntryId={initialEditEntryId}
        onOpenEntered={() => void openEntered()}
      />
      {/* 一括エントリーバー */}
      <BulkEntryBar
        count={selectedIds.size}
        totalFee={selectedTotalFee}
        onClear={() => setSelectedIds(new Set())}
        onProceed={() => setBulkOpen(true)}
      />

      {/* 一括エントリーモーダル */}
      {bulkOpen && (
        <BulkEntryModal
          tournaments={selectedTournaments}
          viewer={viewer}
          onRemove={(id) => toggleSelect(id)}
          onClose={() => setBulkOpen(false)}
          onDone={(okCount, total) => {
            setBulkOpen(false);
            setSelectedIds(new Set());
            if (okCount === total && okCount > 0) {
              showToast(`${okCount}件のエントリーが完了しました`, "success");
            }
            router.refresh();
          }}
          onToast={showToast}
        />
      )}

      {/* 申込中一覧 */}
      {enteredOpen && myEntries && (
        <EnteredTournamentsModal
          personal={myEntries.personal}
          team={myEntries.team}
          teamName={myEntries.teamName}
          initialScope={enteredScope}
          onClose={() => setEnteredOpen(false)}
          onCancel={(entry) => setCancelTarget(entry)}
          onEditMembers={(entry) => setEditTarget(entry)}
          onOpenDetail={(entry) => {
            const t = tournaments.find((x) => x.id === entry.tournamentId);
            if (!t) return;
            setEnteredOpen(false);
            setDetailOverride([t]);
            setDetailFocusEntryId(entry.entryId);
            setViewerIndex(0);
          }}
        />
      )}

      {/* キャンセル */}
      {cancelTarget && (
        <CancelEntryModal
          entry={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={async (message) => {
            setCancelTarget(null);
            showToast(message, "success");
            // 一覧を再取得し、残枠も更新。
            const data = await getMyEntriesAction();
            setMyEntries(data);
            router.refresh();
          }}
          onToast={showToast}
        />
      )}

      {/* メンバー変更 */}
      {editTarget && (
        <EditMembersModal
          entry={editTarget}
          viewer={viewer}
          onClose={() => setEditTarget(null)}
          onDone={async (message) => {
            setEditTarget(null);
            showToast(message, "success");
            const data = await getMyEntriesAction();
            setMyEntries(data);
          }}
          onToast={showToast}
        />
      )}

      {/* トースト */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
