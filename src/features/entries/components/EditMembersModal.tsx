// 出場メンバー変更モーダル（未定枠割当・差し替え）。
// 大会開催3日前まで変更可能（サーバー側でも検証）。
"use client";

import { useState } from "react";
import { X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMembersAction } from "@/features/entries/server/actions";
import { MemberSlots, type SlotValue } from "@/features/entries/components/MemberSlots";
import { formatEventDate } from "@/utils/date";
import type { EntrySummary } from "@/features/entries/types/entry";
import type { EntryViewer } from "@/features/entries/server/entryViewData";

type Props = {
  entry: EntrySummary;
  viewer: EntryViewer;
  onClose: () => void;
  onDone: (message: string) => void;
  onToast: (message: string, type: "success" | "error") => void;
};

// 既存メンバー → 編集スロットへ変換。
function toSlots(entry: EntrySummary): SlotValue[] {
  if (entry.members.length === 0) {
    return [{ memberType: "PENDING", orderNo: 1 }];
  }
  return entry.members.map((m) => ({
    memberType: m.memberType,
    userId: m.userId ?? undefined,
    guestName: m.guestName ?? undefined,
    orderNo: m.orderNo,
  }));
}

export function EditMembersModal({
  entry,
  viewer,
  onClose,
  onDone,
  onToast,
}: Props) {
  const [slots, setSlots] = useState<SlotValue[]>(() => toSlots(entry));
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    const res = await updateMembersAction({
      entryId: entry.entryId,
      members: slots,
    });
    setSubmitting(false);
    if (!res.ok) {
      onToast(res.message ?? "更新に失敗しました", "error");
      return;
    }
    onDone(res.message ?? "メンバー構成を更新しました");
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/80 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">出場メンバーの確認・変更</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">{entry.tournamentTitle}</div>
            <div className="text-xs text-slate-500 tabular-nums">
              {formatEventDate(entry.eventDate)} · {entry.venue}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            ※未定枠への選手割り当てや登録メンバーの交代が行えます（開催3日前まで変更可能）。
          </p>

          <MemberSlots
            slots={slots}
            onChange={setSlots}
            teamMembers={viewer.team?.members ?? []}
          />
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            閉じる
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            isLoading={submitting}
            disabled={submitting}
            onClick={handleSave}
          >
            変更を保存する
          </Button>
        </div>
      </div>
    </div>
  );
}
