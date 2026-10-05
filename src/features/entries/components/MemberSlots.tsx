// 出場メンバー登録スロット（エントリー申込・メンバー変更で共用）。
// requirements-detail-user.md 3.1 のメンバー指定3種に対応：
//  1. チーム内（REGISTERED）: チームメンバーから選択（user_id 紐付け）
//  2. チーム外（GUEST）     : 氏名入力
//  3. 未定枠（PENDING）     : 後日割当
"use client";

import { UserCheck, UserPlus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntryMemberInput } from "@/features/entries/types/schema";
import type { TeamMemberView } from "@/features/teams/types/team";

export type SlotValue = EntryMemberInput;

type Props = {
  slots: SlotValue[];
  onChange: (slots: SlotValue[]) => void;
  // 選択候補（チームメンバー）。個人戦（シングルス）では使わない。
  teamMembers: TeamMemberView[];
};

const TYPE_TABS: Array<{
  type: SlotValue["memberType"];
  label: string;
  icon: typeof UserCheck;
}> = [
  { type: "REGISTERED", label: "チーム内", icon: UserCheck },
  { type: "GUEST", label: "チーム外", icon: UserPlus },
  { type: "PENDING", label: "未定枠", icon: HelpCircle },
];

export function MemberSlots({ slots, onChange, teamMembers }: Props) {
  function updateSlot(index: number, patch: Partial<SlotValue>) {
    const next = slots.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {slots.map((slot, index) => (
        <div
          key={index}
          className="p-3 rounded-xl border border-slate-200 bg-white space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 tabular-nums">
              メンバー {slot.orderNo}
            </span>
            {/* 種別タブ */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
              {TYPE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = slot.memberType === tab.type;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    onClick={() =>
                      updateSlot(index, {
                        memberType: tab.type,
                        userId: undefined,
                        guestName: undefined,
                      })
                    }
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition min-h-[32px]",
                      active
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden min-[380px]:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 種別ごとの入力 */}
          {slot.memberType === "REGISTERED" && (
            <select
              value={slot.userId ?? ""}
              onChange={(e) => updateSlot(index, { userId: e.target.value })}
              className="w-full text-sm bg-white border border-slate-200 rounded-lg px-2.5 min-h-[44px] text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="">メンバーを選択...</option>
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.realName}（{m.nickname} / Lv.{m.granLevel}）
                </option>
              ))}
            </select>
          )}

          {slot.memberType === "GUEST" && (
            <input
              type="text"
              value={slot.guestName ?? ""}
              onChange={(e) => updateSlot(index, { guestName: e.target.value })}
              placeholder="氏名を入力（例: 山田 太郎）"
              maxLength={40}
              className="w-full text-sm bg-white border border-slate-200 rounded-lg px-2.5 min-h-[44px] text-slate-800 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          )}

          {slot.memberType === "PENDING" && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
              未定枠として登録します。後日、代表者がメンバーを割り当てられます（開催3日前まで変更可）。
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
