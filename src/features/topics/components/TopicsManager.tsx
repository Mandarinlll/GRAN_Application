// トピックス管理画面（一覧・追加・編集・削除・並び替え・公開切替）。
// 操作は /api/admin/topics 系 API を呼ぶ。権限判定は API 側（サーバー）で行う。
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_TOPIC_BODY_LENGTH,
  MAX_TOPIC_IMAGES,
  type AdminTopic,
  type TopicImage,
  type TopicStatus,
} from "@/features/topics/types/topic";
import { TOPIC_STATUS_LABEL } from "@/features/topics/utils/topicStatus";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const STATUS_STYLE: Record<TopicStatus, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNPUBLISHED: "bg-slate-100 text-slate-600 border-slate-200",
  SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200",
  EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
};

// "YYYY-MM-DD HH:MM:SS" → datetime-local 用 "YYYY-MM-DDTHH:MM"
const toInputValue = (v: string | null) => (v ? v.slice(0, 16).replace(" ", "T") : "");

type ApiResult = { ok: boolean; message?: string; fieldErrors?: Record<string, string> };

async function call(url: string, init: RequestInit): Promise<ApiResult> {
  try {
    const res = await fetch(url, init);
    const body = (await res.json().catch(() => ({}))) as ApiResult;
    if (res.ok) return { ok: true };
    const fallback =
      res.status === 403 ? "この操作を行う権限がありません。" : res.status === 401 ? "ログインが必要です。" : "処理に失敗しました。";
    return { ok: false, message: body.message ?? fallback, fieldErrors: body.fieldErrors };
  } catch {
    return { ok: false, message: "通信に失敗しました。" };
  }
}

export function TopicsManager({ topics }: { topics: AdminTopic[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminTopic | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<ApiResult>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.message ?? "処理に失敗しました。");
    else router.refresh();
    return r;
  }

  const move = (index: number, delta: -1 | 1) => {
    const ids = topics.map((t) => t.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() =>
      call("/api/admin/topics/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    );
  };

  const togglePublish = (t: AdminTopic) => {
    const fd = new FormData();
    fd.set("isPublished", String(!t.isPublished));
    void run(() => call(`/api/admin/topics/${t.id}`, { method: "PATCH", body: fd }));
  };

  const remove = (t: AdminTopic) => {
    if (!window.confirm(`「${t.title}」を削除します。画像も削除されます。よろしいですか？`)) return;
    void run(() => call(`/api/admin/topics/${t.id}`, { method: "DELETE" }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">トピックス管理</h2>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          新規追加
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {editing ? (
        <TopicForm
          key={editing === "new" ? "new" : editing.id}
          topic={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      {topics.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
          トピックスはまだありません。「新規追加」から登録してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {topics.map((t, i) => (
            <li key={t.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.imageSrc} alt={t.title} className="w-full sm:w-40 aspect-video object-cover rounded-lg bg-slate-100" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", STATUS_STYLE[t.status])}>
                    {TOPIC_STATUS_LABEL[t.status]}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">表示順 {i + 1}</span>
                </div>
                <p className="font-bold text-sm text-slate-900 truncate">{t.title}</p>
                <p className="text-xs text-slate-500">画像 {t.images.length} 枚{t.body ? "・本文あり" : ""}</p>
                <p className="text-xs text-slate-500 truncate">リンク先: {t.linkUrl ?? "なし"}</p>
                <p className="text-xs text-slate-500">
                  公開期間: {t.publishFrom?.slice(0, 16) ?? "指定なし"} 〜 {t.publishUntil?.slice(0, 16) ?? "指定なし"}
                </p>
              </div>
              <div className="flex sm:flex-col gap-1 flex-wrap">
                <div className="flex gap-1">
                  <IconButton label="上へ" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="w-4 h-4" />
                  </IconButton>
                  <IconButton label="下へ" disabled={busy || i === topics.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="w-4 h-4" />
                  </IconButton>
                  <IconButton label={t.isPublished ? "非公開にする" : "公開する"} disabled={busy} onClick={() => togglePublish(t)}>
                    {t.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </IconButton>
                </div>
                <div className="flex gap-1">
                  <IconButton label="編集" disabled={busy} onClick={() => setEditing(t)}>
                    <Pencil className="w-4 h-4" />
                  </IconButton>
                  <IconButton label="削除" disabled={busy} onClick={() => remove(t)} danger>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-11 h-11 flex items-center justify-center rounded-lg border transition disabled:opacity-40",
        danger
          ? "border-rose-200 text-rose-600 hover:bg-rose-50"
          : "border-slate-200 text-slate-600 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}

function TopicForm({
  topic,
  onClose,
  onSaved,
}: {
  topic: AdminTopic | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bodyLength, setBodyLength] = useState((topic?.body ?? "").length);
  // 既存画像（表示順。先頭がカバー画像）と、これから追加する画像。
  const [kept, setKept] = useState<TopicImage[]>(topic?.images ?? []);
  const [added, setAdded] = useState<File[]>([]);
  const previews = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added]);
  const total = kept.length + added.length;

  const moveKept = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= kept.length) return;
    const next = [...kept];
    [next[i], next[j]] = [next[j], next[i]];
    setKept(next);
  };

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    if (picked.some((f) => f.size > MAX_UPLOAD_BYTES)) {
      setMessage("画像は1枚あたり10MB以下にしてください。");
      return;
    }
    if (total + picked.length > MAX_TOPIC_IMAGES) {
      setMessage(`画像は${MAX_TOPIC_IMAGES}枚までです。`);
      return;
    }
    setMessage(null);
    setAdded((cur) => [...cur, ...picked]);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setFieldErrors({});
    if (total < 1) {
      setMessage("画像を1枚以上選択してください。");
      return;
    }
    const fd = new FormData(e.currentTarget);
    // チェックボックスは未チェックだと送信されないため、明示的に true/false を送る。
    fd.set("isPublished", String(fd.get("isPublished") === "on"));
    added.forEach((f) => fd.append("files", f));
    if (topic) {
      const keptIds = new Set(kept.map((k) => k.id));
      topic.images.filter((i) => !keptIds.has(i.id)).forEach((i) => fd.append("removeImageIds", i.id));
      kept.forEach((k) => fd.append("imageOrder", k.id));
    }
    setBusy(true);
    const r = await call(topic ? `/api/admin/topics/${topic.id}` : "/api/admin/topics", {
      method: topic ? "PATCH" : "POST",
      body: fd,
    });
    setBusy(false);
    if (r.ok) return onSaved();
    setMessage(r.message ?? "処理に失敗しました。");
    setFieldErrors(r.fieldErrors ?? {});
  }

  const input = "w-full border border-slate-300 rounded-lg px-3 min-h-[44px] text-sm";
  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h2 className="font-bold text-sm text-slate-900">{topic ? "トピックスを編集" : "トピックスを追加"}</h2>
      {message ? (
        <p role="alert" className="text-sm text-rose-700">
          {message}
        </p>
      ) : null}
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700">タイトル（画像の代替テキストにも使用）</span>
        <input name="title" defaultValue={topic?.title ?? ""} maxLength={60} required className={input} />
        <FieldError text={fieldErrors.title} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700">本文（任意・{MAX_TOPIC_BODY_LENGTH}文字まで。改行のみ反映されます）</span>
        <textarea
          name="body"
          defaultValue={topic?.body ?? ""}
          maxLength={MAX_TOPIC_BODY_LENGTH}
          rows={6}
          onChange={(e) => setBodyLength(e.target.value.length)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <span className="block text-xs text-slate-500 text-right tabular-nums">
          {bodyLength} / {MAX_TOPIC_BODY_LENGTH}
        </span>
        <FieldError text={fieldErrors.body} />
      </label>
      <div className="space-y-2">
        <span className="block text-xs font-bold text-slate-700">
          画像（{total} / {MAX_TOPIC_IMAGES} 枚・PNG / JPEG / WebP・1枚10MBまで。先頭がホームに表示されます）
        </span>
        {total > 0 ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kept.map((img, i) => (
              <li key={img.id} className="border border-slate-200 rounded-lg p-1 space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={`画像 ${i + 1}`} className="w-full aspect-video object-cover rounded bg-slate-100" />
                <div className="flex gap-1 justify-between">
                  <span className="text-xs text-slate-500 self-center">{i === 0 ? "カバー" : i + 1}</span>
                  <div className="flex gap-1">
                    <IconButton label="前へ" disabled={busy || i === 0} onClick={() => moveKept(i, -1)}>
                      <ArrowUp className="w-4 h-4" />
                    </IconButton>
                    <IconButton label="後ろへ" disabled={busy || i === kept.length - 1} onClick={() => moveKept(i, 1)}>
                      <ArrowDown className="w-4 h-4" />
                    </IconButton>
                    <IconButton label="画像を削除" disabled={busy} danger onClick={() => setKept(kept.filter((k) => k.id !== img.id))}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
            {added.map((f, i) => (
              <li key={`${f.name}-${i}`} className="border border-emerald-200 rounded-lg p-1 space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews[i]} alt={`追加する画像 ${i + 1}`} className="w-full aspect-video object-cover rounded bg-slate-100" />
                <div className="flex gap-1 justify-between">
                  <span className="text-xs text-emerald-700 self-center">追加</span>
                  <IconButton label="追加を取り消す" disabled={busy} danger onClick={() => setAdded(added.filter((_, k) => k !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={onPickFiles}
          disabled={busy || total >= MAX_TOPIC_IMAGES}
          className="block text-sm"
          aria-label="画像を追加"
        />
        <span className="block text-xs text-slate-500">自動で縮小しWebPに変換します。追加した画像は末尾に並びます。</span>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700">リンク先（任意。「/」始まりの内部パスまたは https のURL）</span>
        <input name="linkUrl" defaultValue={topic?.linkUrl ?? ""} className={input} placeholder="/tournaments" />
        <FieldError text={fieldErrors.linkUrl} />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">公開開始（任意）</span>
          <input name="publishFrom" type="datetime-local" defaultValue={toInputValue(topic?.publishFrom ?? null)} className={input} />
          <FieldError text={fieldErrors.publishFrom} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">公開終了（任意）</span>
          <input name="publishUntil" type="datetime-local" defaultValue={toInputValue(topic?.publishUntil ?? null)} className={input} />
          <FieldError text={fieldErrors.publishUntil} />
        </label>
      </div>
      <label className="flex items-center gap-2 min-h-[44px] text-sm text-slate-700">
        <input name="isPublished" type="checkbox" defaultChecked={topic ? topic.isPublished : true} className="w-4 h-4" />
        公開する
      </label>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} disabled={busy} className="px-4 min-h-[44px] rounded-xl border border-slate-300 text-xs font-bold text-slate-700">
          キャンセル
        </button>
        <button type="submit" disabled={busy} className="px-4 min-h-[44px] rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
function FieldError({ text }: { text?: string }) {
  return text ? <span className="block text-xs text-rose-600">{text}</span> : null;
}
