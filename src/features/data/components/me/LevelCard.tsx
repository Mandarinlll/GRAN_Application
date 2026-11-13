"use client";

import { useRemoteResource } from "../../hooks/useRemoteResource";
import type { LevelDto } from "../../types/dto";
import { ErrorPanel, Skeleton } from "../RegionState";
import { CARD_CLASS, NOTE_CLASS, tierLabel } from "./shared";

export function LevelCard() {
  const { status, data, retry, consecutiveFailures } = useRemoteResource<LevelDto>({
    url: "/api/data/me/level",
    keepStaleOnError: false,
  });

  return (
    <section aria-label="GRANレベルと階級" className={CARD_CLASS}>
      {status === "loading" && <Skeleton label="GRANレベルを読み込み中" lines={3} />}
      {status === "error" && (
        <ErrorPanel
          message="GRANレベルの取得に失敗しました。"
          onRetry={retry}
          consecutiveFailures={consecutiveFailures}
        />
      )}
      {status === "success" && data && <LevelBody level={data} />}
    </section>
  );
}

function LevelBody({ level }: { level: LevelDto }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div>
          <p className={NOTE_CLASS}>GRANレベル</p>
          <p className="text-4xl font-bold tabular-nums">{level.granLevel}</p>
        </div>
        <div>
          <p className={NOTE_CLASS}>現在の階級</p>
          <p className="text-2xl font-bold">
            {level.isCalibrated ? tierLabel(level.tier) : "査定前"}
          </p>
        </div>
      </div>

      {!level.isCalibrated && (
        <p className="text-sm">
          GRANレベルは査定前です。査定が完了すると昇格までのポイント差が表示されます。
        </p>
      )}

      {level.isCalibrated && level.next === null && (
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
          最上位階級（{tierLabel(level.tier)}）です
        </p>
      )}

      {level.isCalibrated && level.next !== null && (
        <div className="space-y-1">
          <p className="text-sm">
            {tierLabel(level.next.tier)}への昇格まであと{" "}
            <span className="font-bold tabular-nums">{level.next.pointsToGo}</span> ポイント
          </p>
          <div
            role="progressbar"
            aria-label={`${tierLabel(level.next.tier)}への進捗`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level.next.progressPercent)}
            className="h-3 w-full overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-xl bg-emerald-600 dark:bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, level.next.progressPercent))}%` }}
            />
          </div>
          <p className={NOTE_CLASS}>
            進捗 {Math.round(level.next.progressPercent)}%（昇格ライン {level.next.threshold}）
          </p>
        </div>
      )}
    </div>
  );
}
