// 単一大会エントリー申込モーダル。
// 種目に応じたメンバースロット、同日重複警告、規約同意、送信を担う。
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Edit3, CheckCircle, Calendar, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitEntryAction } from "@/features/entries/server/actions";
import { MemberSlots, type SlotValue } from "@/features/entries/components/MemberSlots";
import { memberCountRange, isTeamCategory } from "@/features/tournaments/utils/category";
import { CategoryBadge, TierBadge } from "@/features/tournaments/components/badges";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { EntryViewer } from "@/features/entries/server/entryViewData";

type Props = {
  tournament: TournamentCardData;
  viewer: EntryViewer;
  onClose: () => void;
  onSuccess: (entryId: string | undefined, tournament: TournamentCardData) => void;
  onToast: (message: string, type: "success" | "error") => void;
};

// 種目に応じたメンバースロットの初期値を作る。
function buildInitialSlots(
  tournament: TournamentCardData,
  viewer: EntryViewer,
): SlotValue[] {
  if (tournament.category === "SINGLES") {
    // 本人のみ（UI上は表示しないがサーバー側で補完）。
    return [];
  }
  const range = memberCountRange(
    tournament.category,
    tournament.teamSizeMin,
    tournament.teamSizeMax,
  );
  // 代表者を先頭スロットに自動割当（居れば）。残りは未定枠で埋める。
  const leader = viewer.team?.members.find((m) => m.isLeader);
  const slots: SlotValue[] = [];
  for (let i = 0; i < range.min; i++) {
    if (i === 0 && leader) {
      slots.push({ memberType: "REGISTERED", userId: leader.userId, orderNo: 1 });
    } else {
      slots.push({ memberType: "PENDING", orderNo: i + 1 });
    }
  }
  return slots;
}

export function EntryModal({ tournament, viewer, onClose, onSuccess, onToast }: Props) {
  const isTeam = isTeamCategory(tournament.category);
  const isDoubles = tournament.category === "DOUBLES";
  const isSingles = tournament.category === "SINGLES";
  const needsTeam = isTeam || isDoubles;

  const [slots, setSlots] = useState<SlotValue[]>(() =>
    buildInitialSlots(tournament, viewer),
  );
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // ESC で閉じる。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const range = memberCountRange(
    tournament.category,
    tournament.teamSizeMin,
    tournament.teamSizeMax,
  );

  // 代表者が居ない個人ユーザーが団体戦/ダブルスを開こうとした場合の警告。
  const cannotEnter = useMemo(() => {
    if (needsTeam && !viewer.team) {
      return "この種目は代表者（チーム）のみ申込できます。チームを作成するか、代表者にご依頼ください。";
    }
    return null;
  }, [needsTeam, viewer.team]);

  async function handleSubmit() {
    if (!agree) {
      onToast("参加規約・キャンセルポリシーへの同意が必要です", "error");
      return;
    }
    setSubmitting(true);
    const res = await submitEntryAction({
      tournamentId: tournament.id,
      teamId: needsTeam ? viewer.team?.id : undefined,
      members: isSingles ? [] : slots,
      acknowledgeConflict: acknowledged,
      agreeTerms: agree,
    });
    setSubmitting(false);

    if (res.needsConfirm) {
      // 同日重複: 確認を促す。
      setConflicts(res.conflictTournaments ?? []);
      return;
    }
    if (!res.ok) {
      onToast(res.message ?? "エントリーに失敗しました", "error");
      return;
    }
    onSuccess(res.entryId, tournament);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">大会エントリー申込</h3>
              <div className="text-xs text-slate-400 truncate">
                {tournament.eventDateLabel}
              </div>
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

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* 大会サマリー */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={tournament.category} />
              <TierBadge tier={tournament.tier} />
            </div>
            <h4 className="text-base font-bold text-slate-900 leading-snug">
              {tournament.title}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-bold tabular-nums">
                  {tournament.eventDateLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{tournament.venue}</span>
              </div>
            </div>
          </div>

          {/* 代表者権限が無い場合の警告 */}
          {cannotEnter && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{cannotEnter}</p>
            </div>
          )}

          {/* 同日重複警告 */}
          {conflicts && conflicts.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <div className="font-bold text-amber-950">
                  同日エントリーの重複確認
                </div>
                <p className="leading-relaxed">
                  同じ開催日に以下のエントリーがあります。重複参加にならないかご確認の上、問題なければもう一度「エントリーを確定する」を押してください。
                </p>
                <ul className="list-disc list-inside">
                  {conflicts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <label className="flex items-center gap-1.5 pt-1 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span>内容を確認しました</span>
                </label>
              </div>
            </div>
          )}

          {/* 申込者・チーム情報 */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="text-xs font-bold text-slate-400">
              {needsTeam ? "申込チーム・代表者" : "申込者（個人）"}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                {viewer.realName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900">
                  {needsTeam && viewer.team ? viewer.team.name : viewer.realName}
                </div>
                <div className="text-xs text-slate-500">
                  {needsTeam ? `代表: ${viewer.realName}` : `Lv.${viewer.granLevel}`}
                </div>
              </div>
            </div>
          </div>

          {/* メンバー登録（シングルス以外） */}
          {!isSingles && !cannotEnter && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  出場メンバー登録（{range.min}
                  {range.max !== range.min ? `〜${range.max}` : ""}名）
                </span>
                <span className="text-xs text-slate-400">
                  ※後から変更・未定枠割当可
                </span>
              </div>
              <MemberSlots
                slots={slots}
                onChange={setSlots}
                teamMembers={viewer.team?.members ?? []}
              />
            </div>
          )}

          {/* 参加費・キャンセル規定 */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">参加費:</span>
              <span className="font-bold text-emerald-600 text-base tabular-nums">
                {tournament.entryFeeLabel}
              </span>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed border-t border-slate-200/60 pt-2 space-y-1">
              <div className="font-bold text-slate-700">【キャンセル規定】</div>
              <div>
                ・開催8日前まで:{" "}
                <span className="text-emerald-600 font-bold">無料</span>
              </div>
              <div>
                ・開催7日前〜3日前:{" "}
                <span className="text-amber-600 font-bold">キャンセル料 50%</span>
              </div>
              <div>
                ・開催2日前〜当日:{" "}
                <span className="text-rose-600 font-bold">キャンセル料 100%</span>
              </div>
            </div>
          </div>

          {/* 規約同意 */}
          <label className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 mt-0.5"
            />
            <span className="leading-relaxed">
              GRAN競技規則および上記のキャンセルポリシーに同意の上、エントリー申込を行います
            </span>
          </label>
        </div>

        {/* フッター */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            isLoading={submitting}
            disabled={submitting || !!cannotEnter}
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial"
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            エントリーを確定する
          </Button>
        </div>
      </div>
    </div>
  );
}
