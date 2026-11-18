// ステータス変更・中止・削除の操作部品（tournaments.manage のときのみ呼び出し側が描画する）。
// 選択肢は許可された遷移先のみ（Requirement 6.1, 6.4）。CANCELLED は確認ダイアログを経由する。
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import {
  STATUS_LABEL,
  type TournamentStatus,
} from "@/features/tournaments/types/tournament";
import { allowedNextStatuses } from "@/features/tournaments/utils/statusTransitions";
import { CancelConfirmDialog } from "./CancelConfirmDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

type Props = {
  tournamentId: string;
  title: string;
  status: TournamentStatus;
  updatedAt: string;
};

type ApiResult = {
  ok?: boolean;
  message?: string;
  notify?: { total: number; failed: number };
  warning?: string;
};

async function callApi(url: string, init: RequestInit): Promise<{ ok: boolean; body: ApiResult }> {
  try {
    const res = await fetch(url, init);
    const body = (await res.json().catch(() => ({}))) as ApiResult;
    return { ok: res.ok && body.ok !== false, body };
  } catch {
    return { ok: false, body: { message: "通信に失敗しました。時間をおいて再度お試しください。" } };
  }
}

export function StatusChangeControl({ tournamentId, title, status, updatedAt }: Props) {
  const router = useRouter();
  const options = allowedNextStatuses(status);
  const [selected, setSelected] = useState<TournamentStatus | "">("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const base = `/api/admin/tournaments/${encodeURIComponent(tournamentId)}`;

  async function changeStatus(to: TournamentStatus): Promise<boolean> {
    const { ok, body } = await callApi(`${base}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, expectedStatus: status, expectedUpdatedAt: updatedAt }),
    });
    if (!ok) {
      setToast({ message: body.message ?? "ステータスを変更できませんでした。", type: "error" });
      return false;
    }
    let message = body.message ?? "ステータスを変更しました。";
    if (body.notify && body.notify.failed > 0) {
      message = `中止しました。中止通知は ${body.notify.total} 件中 ${body.notify.failed} 件の送信に失敗しました。`;
    } else if (body.notify) {
      message = `中止しました。中止通知を ${body.notify.total} 件送信しました。`;
    }
    setToast({
      message,
      type: body.notify && body.notify.failed > 0 ? "error" : "success",
    });
    setSelected("");
    router.refresh();
    return true;
  }

  function onChangeClick() {
    if (busyRef.current || !selected) return;
    if (selected === "CANCELLED") {
      setCancelOpen(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    void changeStatus(selected).finally(() => {
      busyRef.current = false;
      setBusy(false);
    });
  }

  async function onCancelConfirm() {
    await changeStatus("CANCELLED");
    setCancelOpen(false);
  }

  async function onDeleteConfirm() {
    const { ok, body } = await callApi(base, { method: "DELETE" });
    setDeleteOpen(false);
    if (!ok) {
      setToast({ message: body.message ?? "大会を削除できませんでした。", type: "error" });
      return;
    }
    setToast({
      message: body.warning ? `大会を削除しました。${body.warning}` : "大会を削除しました。",
      type: "success",
    });
    setTimeout(() => router.push("/admin/tournaments"), 1500);
  }

  return (
    <section aria-labelledby="status-control-heading" className="space-y-3">
      <h2 id="status-control-heading" className="text-sm font-bold text-slate-900">
        ステータス変更
      </h2>
      {options.length === 0 ? (
        <p className="text-sm text-slate-500">
          {status === "CANCELLED" ? "中止済み" : "終了済み"}の大会は変更できません。
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="status-select" className="sr-only">
            変更先のステータス
          </label>
          <select
            id="status-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value as TournamentStatus | "")}
            disabled={busy}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            <option value="">変更先を選択</option>
            {options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant={selected === "CANCELLED" ? "destructive" : "primary"}
            disabled={!selected || busy}
            isLoading={busy}
            onClick={onChangeClick}
          >
            {selected === "CANCELLED" ? "中止の確認へ" : "変更する"}
          </Button>
        </div>
      )}

      {status === "DRAFT" && (
        <div className="pt-2">
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            この大会を削除
          </Button>
        </div>
      )}

      <CancelConfirmDialog
        open={cancelOpen}
        tournamentId={tournamentId}
        tournamentTitle={title}
        onConfirm={onCancelConfirm}
        onCancel={() => setCancelOpen(false)}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        tournamentTitle={title}
        onConfirm={onDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
      />
      <Toast toast={toast} onClose={closeToast} durationMs={4500} />
    </section>
  );
}
