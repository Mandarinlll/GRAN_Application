"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRemoteResource } from "../../hooks/useRemoteResource";
import type { ParticipationRowDto } from "../../types/dto";
import { EmptyState, ErrorPanel, Skeleton } from "../RegionState";
import { ParticipationDetail } from "./ParticipationDetail";
import { ParticipationFilters, type ParticipationFilterState } from "./ParticipationFilters";
import { ParticipationTable } from "./ParticipationTable";

const PAGE_SIZE = 20;

interface PageResponse {
  rows: ParticipationRowDto[];
  total: number;
  nextOffset: number | null;
  years: number[];
}

interface Loaded {
  rows: ParticipationRowDto[];
  total: number;
  nextOffset: number | null;
}

const INITIAL_FILTER: ParticipationFilterState = { order: "desc" };

function buildUrl(f: ParticipationFilterState, offset: number): string {
  const p = new URLSearchParams();
  if (f.division) p.set("division", f.division);
  if (f.tier) p.set("tier", f.tier);
  if (f.year !== undefined) p.set("year", String(f.year));
  p.set("order", f.order);
  p.set("offset", String(offset));
  p.set("limit", String(PAGE_SIZE));
  return `/api/data/participations?${p.toString()}`;
}

const buttonClass =
  "min-h-[44px] rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:text-slate-900 dark:hover:bg-emerald-400 dark:focus-visible:ring-emerald-500";

export function ParticipationView() {
  const [filter, setFilter] = useState<ParticipationFilterState>(INITIAL_FILTER);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const { status, data, consecutiveFailures, retry } = useRemoteResource<PageResponse>({
    url: buildUrl(filter, offset),
  });

  // 取得結果を反映（offset=0 は置換、続きは末尾に追加）
  useEffect(() => {
    if (status !== "success" || !data) return;
    setYears((prev) => (data.years.length > 0 || prev.length === 0 ? data.years : prev));
    setLoaded((prev) => {
      if (offset === 0) {
        return { rows: data.rows, total: data.total, nextOffset: data.nextOffset };
      }
      if (!prev || prev.nextOffset !== offset) return prev;
      return {
        rows: [...prev.rows, ...data.rows],
        total: data.total,
        nextOffset: data.nextOffset,
      };
    });
  }, [status, data, offset]);

  const changeFilter = (next: ParticipationFilterState) => {
    setFilter(next);
    setOffset(0);
    setLoaded(null);
  };

  // 詳細の開閉（history 連動）
  const openDetail = useCallback((row: ParticipationRowDto, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    window.history.pushState({ detail: row.tournamentId }, "");
    setSelectedId(row.tournamentId);
  }, []);

  const requestClose = useCallback(() => {
    // popstate 経由で閉じる（ブラウザの戻る操作と同じ経路）
    if (window.history.state && window.history.state.detail) window.history.back();
    else setSelectedId(null);
  }, []);

  useEffect(() => {
    const onPop = () => setSelectedId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 閉じたら押下した行へフォーカスを戻す
  const wasOpen = useRef(false);
  useEffect(() => {
    if (selectedId === null && wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = selectedId !== null;
  }, [selectedId]);

  const hasFilter =
    filter.division !== undefined || filter.tier !== undefined || filter.year !== undefined;
  const loadingMore = offset > 0 && status === "loading";
  const loadMoreFailed = offset > 0 && status === "error";

  let body: React.ReactNode;
  if (loaded === null) {
    if (status === "error") {
      body = (
        <ErrorPanel
          message="出場履歴の取得に失敗しました。"
          onRetry={retry}
          consecutiveFailures={consecutiveFailures}
        />
      );
    } else {
      body = <Skeleton label="出場履歴を読み込み中" lines={5} />;
    }
  } else if (loaded.total === 0) {
    body = hasFilter ? (
      <EmptyState
        message="条件に一致する出場履歴がありません。"
        action={
          <button type="button" onClick={() => changeFilter({ order: filter.order })} className={buttonClass}>
            絞り込みを解除
          </button>
        }
      />
    ) : (
      <EmptyState
        message="出場履歴はまだありません。"
        action={
          <Link href="/tournaments" className={`${buttonClass} inline-flex items-center`}>
            大会日程を見る
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-xs text-slate-700 dark:text-slate-300">全{loaded.total}件</p>
        <ParticipationTable rows={loaded.rows} onSelect={openDetail} />
        {loadingMore && <Skeleton label="続きを読み込み中" lines={1} />}
        {loadMoreFailed && (
          <ErrorPanel
            message="続きの取得に失敗しました。"
            onRetry={retry}
            consecutiveFailures={consecutiveFailures}
          />
        )}
        {loaded.nextOffset !== null && !loadingMore && !loadMoreFailed && (
          <div className="text-center">
            <button type="button" onClick={() => setOffset(loaded.nextOffset as number)} className={buttonClass}>
              もっと見る
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ParticipationFilters value={filter} years={years} onChange={changeFilter} />
      {body}
      {selectedId !== null && <ParticipationDetail tournamentId={selectedId} onClose={requestClose} />}
    </div>
  );
}
