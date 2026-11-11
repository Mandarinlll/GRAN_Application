"use client";

import type { KeyboardEvent } from "react";
import { CATEGORY_LABEL } from "@/features/tournaments/types/tournament";
import type { ParticipationRowDto } from "../../types/dto";
import { resultLabel } from "../../utils/participation";
import { DIVISION_LABEL } from "./ParticipationFilters";

export function formatDateSlash(d: string): string {
  return d.slice(0, 10).replaceAll("-", "/");
}

function ResultText({ row }: { row: ParticipationRowDto }) {
  if (row.result === null) {
    return (
      <span className="italic text-slate-700 dark:text-slate-300">
        <span aria-hidden="true">⏳ </span>未確定
      </span>
    );
  }
  return <span>{resultLabel(row.result)}</span>;
}

const rowClass =
  "min-h-[44px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-500";

export function ParticipationTable({
  rows,
  onSelect,
}: {
  rows: ParticipationRowDto[];
  onSelect: (row: ParticipationRowDto, trigger: HTMLElement) => void;
}) {
  const handleKey = (e: KeyboardEvent<HTMLElement>, row: ParticipationRowDto) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(row, e.currentTarget);
    }
  };

  return (
    <>
      {/* md以上: 表 */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-2 font-bold">開催年月日</th>
              <th scope="col" className="px-4 py-2 font-bold">会場</th>
              <th scope="col" className="px-4 py-2 font-bold">種目</th>
              <th scope="col" className="px-4 py-2 font-bold">階級</th>
              <th scope="col" className="px-4 py-2 font-bold">結果</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.tournamentId}
                role="button"
                tabIndex={0}
                aria-label={`${row.title} の詳細を表示`}
                onClick={(e) => onSelect(row, e.currentTarget)}
                onKeyDown={(e) => handleKey(e, row)}
                className={`${rowClass} border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800`}
              >
                <td className="px-4 py-2">{formatDateSlash(row.eventDate)}</td>
                <td className="px-4 py-2">{row.venue}</td>
                <td className="px-4 py-2">
                  {row.genderDivision ? DIVISION_LABEL[row.genderDivision] : CATEGORY_LABEL[row.category]}
                </td>
                <td className="px-4 py-2">{row.tier}級</td>
                <td className="px-4 py-2">
                  <ResultText row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* md未満: 3項目のカード行 */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.tournamentId}>
            <div
              role="button"
              tabIndex={0}
              aria-label={`${row.title} の詳細を表示`}
              onClick={(e) => onSelect(row, e.currentTarget)}
              onKeyDown={(e) => handleKey(e, row)}
              className={`${rowClass} rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100`}
            >
              <p className="font-bold">{formatDateSlash(row.eventDate)}</p>
              <p className="break-words">{row.venue}</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                <ResultText row={row} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
