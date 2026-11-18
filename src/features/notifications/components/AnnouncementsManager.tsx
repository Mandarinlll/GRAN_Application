// 通知管理画面（運営からのお知らせ・緊急連絡の送信と送信履歴）。
// 送信は /api/admin/notifications を呼ぶ。権限判定は API 側（サーバー）で行う。
// 将来、トピックス管理をこの画面内に統合する想定（タブ追加で拡張する）。
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminAnnouncement,
  AnnouncementTournamentOption,
} from "@/features/notifications/types/announcement";
import {
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
} from "@/features/notifications/types/announcementSchema";

type Audience = "ALL" | "TOURNAMENT";
type ApiResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  recipientCount?: number;
};

const INPUT =
  "w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";

async function send(payload: unknown): Promise<ApiResult> {
  try {
    const res = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as ApiResult;
    if (res.ok) return body;
    const fallback =
      res.status === 403
        ? "この操作を行う権限がありません。"
        : res.status === 401
          ? "ログインが必要です。"
          : "送信に失敗しました。";
    return { ok: false, message: body.message ?? fallback, fieldErrors: body.fieldErrors };
  } catch {
    return { ok: false, message: "通信に失敗しました。" };
  }
}

export function AnnouncementsManager({
  announcements,
  tournaments,
}: {
  announcements: AdminAnnouncement[];
  tournaments: AnnouncementTournamentOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [audience, setAudience] = useState<Audience>("ALL");
  const [tournamentId, setTournamentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const target =
      audience === "ALL"
        ? "全ユーザー"
        : (tournaments.find((t) => t.id === tournamentId)?.title ?? "選択した大会") + " の確定エントリー者";
    const label = isUrgent ? "緊急連絡" : "お知らせ";
    if (!window.confirm(`${target}へ${label}「${title.trim()}」を送信します。取り消しはできません。よろしいですか？`)) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    const r = await send({
      title,
      body,
      isUrgent,
      audience,
      tournamentId: audience === "TOURNAMENT" ? tournamentId : null,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message ?? "送信に失敗しました。");
      setFieldErrors(r.fieldErrors ?? {});
      return;
    }
    setNotice(`${r.recipientCount ?? 0}人に送信しました。`);
    setTitle("");
    setBody("");
    setIsUrgent(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">運営からの通知を送信</h2>

        <div className="space-y-1">
          <label htmlFor="ann-audience" className="text-xs font-bold text-slate-600">送信先</label>
          <select
            id="ann-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            className={INPUT}
          >
            <option value="ALL">全ユーザー</option>
            <option value="TOURNAMENT">大会の確定エントリー者</option>
          </select>
        </div>

        {audience === "TOURNAMENT" ? (
          <div className="space-y-1">
            <label htmlFor="ann-tournament" className="text-xs font-bold text-slate-600">対象の大会</label>
            <select
              id="ann-tournament"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className={INPUT}
            >
              <option value="">選択してください</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.eventDate} {t.title}
                </option>
              ))}
            </select>
            {fieldErrors.tournamentId ? <p className="text-xs text-rose-600">{fieldErrors.tournamentId}</p> : null}
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-800 min-h-[44px]">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="font-bold">緊急連絡として送信する</span>
          <span className="text-xs text-slate-500">（天候不良による中止・コート変更など。配信ログにも記録されます）</span>
        </label>

        <div className="space-y-1">
          <label htmlFor="ann-title" className="text-xs font-bold text-slate-600">タイトル</label>
          <input
            id="ann-title"
            value={title}
            maxLength={MAX_ANNOUNCEMENT_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT}
          />
          {fieldErrors.title ? <p className="text-xs text-rose-600">{fieldErrors.title}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="ann-body" className="text-xs font-bold text-slate-600">本文</label>
          <textarea
            id="ann-body"
            value={body}
            maxLength={MAX_ANNOUNCEMENT_BODY}
            rows={6}
            onChange={(e) => setBody(e.target.value)}
            className={INPUT}
          />
          <p className="text-xs text-slate-400 text-right tabular-nums">
            {body.length} / {MAX_ANNOUNCEMENT_BODY}
          </p>
          {fieldErrors.body ? <p className="text-xs text-rose-600">{fieldErrors.body}</p> : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !title.trim() || !body.trim() || (audience === "TOURNAMENT" && !tournamentId)}
          className={cn(
            "min-h-[44px] px-5 rounded-xl text-white text-xs font-bold disabled:opacity-50 transition",
            isUrgent ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700",
          )}
        >
          {busy ? "送信中…" : isUrgent ? "緊急連絡を送信" : "お知らせを送信"}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">送信履歴</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
            送信済みの通知はまだありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border",
                      a.isUrgent
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200",
                    )}
                  >
                    {a.isUrgent ? <Siren className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
                    {a.isUrgent ? "緊急連絡" : "お知らせ"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {a.tournamentTitle ? `大会: ${a.tournamentTitle}` : "全ユーザー"} / {a.recipientCount}人
                  </span>
                  <span className="ml-auto text-xs text-slate-400 tabular-nums">
                    {a.createdAt.slice(0, 16)}
                    {a.createdByLoginId ? ` ${a.createdByLoginId}` : ""}
                  </span>
                </div>
                <p className="font-bold text-sm text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}