"use client";

import Link from "next/link";
import { useRemoteResource } from "../../hooks/useRemoteResource";
import type { RecentMatchDto } from "../../types/dto";
import { formatRate1, winRatePercent1 } from "../../utils/winRate";
import { EmptyState, ErrorPanel, Skeleton } from "../RegionState";
import { RecentMatches } from "./RecentMatches";
import { CARD_CLASS, NOTE_CLASS, SECTION_TITLE_CLASS } from "./shared";

interface RecordDto {
  total: number;
  wins: number;
  losses: number;
  recent: RecentMatchDto[];
}

export function RecordSummary() {
  const { status, data, retry, consecutiveFailures } = useRemoteResource<RecordDto>({
    url: "/api/data/me/record",
    keepStaleOnError: false,
  });

  return (
    <section aria-label="通算成績" className={`${CARD_CLASS} space-y-3`}>
      <h2 className={SECTION_TITLE_CLASS}>通算成績</h2>

      {status === "loading" && <Skeleton label="通算成績を読み込み中" lines={3} />}
      {status === "error" && (
        <ErrorPanel
          message="通算成績の取得に失敗しました。"
          onRetry={retry}
          consecutiveFailures={consecutiveFailures}
        />
      )}

      {status === "success" && data && (
        <>
          <dl className="grid grid-cols-4 gap-2 text-center">
            <Stat label="試合数" value={String(data.total)} />
            <Stat label="勝利" value={String(data.wins)} />
            <Stat label="敗北" value={String(data.losses)} />
            <Stat label="勝率" value={formatRate1(winRatePercent1(data.wins, data.total))} />
          </dl>

          {data.total === 0 ? (
            <EmptyState message="まだ試合実績がありません。" />
          ) : (
            <RecentMatches matches={data.recent} />
          )}

          <p className={NOTE_CLASS}>
            詳しい勝敗データは
            <Link
              href="/data/participations"
              className="font-bold text-emerald-700 underline dark:text-emerald-300"
            >
              出場データ
            </Link>
            で確認できます。
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
      <dt className={NOTE_CLASS}>{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
