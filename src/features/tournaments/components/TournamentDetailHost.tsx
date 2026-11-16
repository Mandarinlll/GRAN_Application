// 大会詳細（要項ビューア）と、そこから起動する操作モーダル群をひとまとめにした共通コンポーネント。
// 大会日程ページ・ホームのカレンダーの両方から使い、同じ詳細画面・同じ操作（エントリー、
// キャンセル待ち、メンバー変更、キャンセル申請）を提供する。
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { GuidelinesViewer } from "@/features/tournaments/components/GuidelinesViewer";
import { FlyerLightbox } from "@/features/tournaments/components/FlyerLightbox";
import { EntryModal } from "@/features/entries/components/EntryModal";
import { WaitlistModal } from "@/features/entries/components/WaitlistModal";
import { EntrySuccessModal } from "@/features/entries/components/EntrySuccessModal";
import { CancelEntryModal } from "@/features/entries/components/CancelEntryModal";
import { EditMembersModal } from "@/features/entries/components/EditMembersModal";
import {
  getMyEntriesAction,
  type MyEntriesResult,
} from "@/features/entries/server/actions";
import type { TournamentCardData } from "@/features/tournaments/types/view";
import type { EntryViewer } from "@/features/entries/server/entryViewData";
import type { EntrySummary } from "@/features/entries/types/entry";

type Props = {
  tournaments: TournamentCardData[]; // 前後送りの対象
  index: number | null; // 表示中の大会（null なら詳細は閉じる。成功モーダル等のため常に配置しておく）
  onIndexChange: (next: number | null) => void;
  viewer: EntryViewer;
  // 通知ページからの導線などで、先に開くエントリー（同じ大会に複数ある場合の優先表示）。
  focusEntryId?: string | null;
  // 完了モーダルの「申込中一覧を見る」押下時の動作（未指定なら閉じるだけ）。
  onOpenEntered?: () => void;
  // 初期表示でメンバー変更モーダルを開くエントリー。
  initialEditEntryId?: string | null;
};

export function TournamentDetailHost({
  tournaments,
  index,
  onIndexChange,
  viewer,
  focusEntryId = null,
  onOpenEntered,
  initialEditEntryId = null,
}: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [flyer, setFlyer] = useState<TournamentCardData | null>(null);
  const [entryTarget, setEntryTarget] = useState<TournamentCardData | null>(null);
  const [waitlistTarget, setWaitlistTarget] = useState<TournamentCardData | null>(null);
  const [success, setSuccess] = useState<{
    kind: "entry" | "waitlist";
    tournament: TournamentCardData;
    queueNumber?: number;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EntrySummary | null>(null);
  const [editTarget, setEditTarget] = useState<EntrySummary | null>(null);
  const [myEntries, setMyEntries] = useState<MyEntriesResult | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const reloadEntries = useCallback(async () => {
    const data = await getMyEntriesAction();
    setMyEntries(data);
    return data;
  }, []);

  // 詳細を開いたとき（および大会を切り替えたとき）に、最新のエントリーを取得する。
  useEffect(() => {
    if (index === null) return;
    void reloadEntries();
  }, [index, reloadEntries]);

  // 通知ページからの遷移: 該当エントリーのメンバー変更モーダルを開く。
  useEffect(() => {
    if (!initialEditEntryId) return;
    let cancelled = false;
    getMyEntriesAction().then((data) => {
      if (cancelled) return;
      const target = [...data.personal, ...data.team].find(
        (e) => e.entryId === initialEditEntryId && e.kind === "CONFIRMED",
      );
      if (target) {
        setMyEntries(data);
        setEditTarget(target);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialEditEntryId]);

  const current = index !== null ? tournaments[index] : undefined;

  // 表示中の大会に対する、有効な（キャンセル済み以外の）自分のエントリー。
  const currentEntries = useMemo(() => {
    if (!current || !myEntries) return [];
    const all = [...myEntries.personal, ...myEntries.team].filter(
      (e, i, arr) =>
        e.tournamentId === current.id &&
        e.kind !== "CANCELLED" &&
        arr.findIndex((x) => x.entryId === e.entryId) === i,
    );
    return all.sort(
      (a, b) =>
        Number(b.entryId === focusEntryId) - Number(a.entryId === focusEntryId),
    );
  }, [current, myEntries, focusEntryId]);

  function handleEntrySuccess(_id: string | undefined, tournament: TournamentCardData) {
    setEntryTarget(null);
    onIndexChange(null);
    setSuccess({ kind: "entry", tournament });
    void reloadEntries();
    router.refresh();
  }
  function handleWaitlistSuccess(
    queueNumber: number | undefined,
    tournament: TournamentCardData,
  ) {
    setWaitlistTarget(null);
    onIndexChange(null);
    setSuccess({ kind: "waitlist", tournament, queueNumber });
    void reloadEntries();
    router.refresh();
  }

  return (
    <>
      {current && (
        <GuidelinesViewer
          tournaments={tournaments}
          index={index as number}
          onIndexChange={onIndexChange}
          onClose={() => onIndexChange(null)}
          onOpenFlyer={setFlyer}
          onEntry={(t) => setEntryTarget(t)}
          onWaitlist={(t) => setWaitlistTarget(t)}
          entries={currentEntries}
          onEditMembers={(e) => setEditTarget(e)}
          onCancel={(e) => setCancelTarget(e)}
        />
      )}
      {flyer && <FlyerLightbox tournament={flyer} onClose={() => setFlyer(null)} />}
      {entryTarget && (
        <EntryModal
          tournament={entryTarget}
          viewer={viewer}
          onClose={() => setEntryTarget(null)}
          onSuccess={handleEntrySuccess}
          onToast={showToast}
        />
      )}
      {waitlistTarget && (
        <WaitlistModal
          tournament={waitlistTarget}
          viewer={viewer}
          onClose={() => setWaitlistTarget(null)}
          onSuccess={handleWaitlistSuccess}
          onToast={showToast}
        />
      )}
      {success && (
        <EntrySuccessModal
          kind={success.kind}
          tournament={success.tournament}
          queueNumber={success.queueNumber}
          onClose={() => setSuccess(null)}
          onOpenEntered={() => {
            setSuccess(null);
            onOpenEntered?.();
          }}
        />
      )}
      {cancelTarget && (
        <CancelEntryModal
          entry={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={async (message) => {
            setCancelTarget(null);
            showToast(message, "success");
            await reloadEntries();
            router.refresh();
          }}
          onToast={showToast}
        />
      )}
      {editTarget && (
        <EditMembersModal
          entry={editTarget}
          viewer={viewer}
          onClose={() => setEditTarget(null)}
          onDone={async (message) => {
            setEditTarget(null);
            showToast(message, "success");
            await reloadEntries();
            router.refresh();
          }}
          onToast={showToast}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}