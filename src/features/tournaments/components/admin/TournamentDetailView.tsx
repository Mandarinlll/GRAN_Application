// 大会詳細（Server Component）。全項目・統計（部分失敗表示）・警告・エントリー状況へのリンクを表示する。
// 入金状況を更新する操作要素は置かない（Requirement 11.12）。表示は React のエスケープに任せる。
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Copy, ListChecks, Pencil } from "lucide-react";
import type {
  AdminTournament,
  AdminTournamentStats,
  StatResult,
} from "@/features/tournaments/types/adminTournament";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  TIER_LABEL,
} from "@/features/tournaments/types/tournament";
import {
  formatCapacityRatio,
  isDraftOverdue,
  isUnderCapacityAlert,
  totalEntryFee,
} from "@/features/tournaments/utils/alerts";
import { StatusChangeControl } from "./StatusChangeControl";

const SURFACE_LABEL: Record<NonNullable<AdminTournament["surface"]>, string> = {
  HARD: "ハード",
  CLAY: "クレー",
  ARTIFICIAL_GRASS: "砂入り人工芝",
  OTHER: "その他",
};

const GENDER_LABEL: Record<NonNullable<AdminTournament["genderDivision"]>, string> = {
  MEN: "男子",
  WOMEN: "女子",
  MIXED: "ミックス",
};

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

function Unset() {
  return <span className="text-slate-400">未設定</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 min-w-0 whitespace-pre-wrap break-words text-slate-900 tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function text(v: string | null) {
  return v !== null && v.trim() !== "" ? v : <Unset />;
}

function num(v: number | null, suffix = "") {
  return v === null ? <Unset /> : `${v.toLocaleString("ja-JP")}${suffix}`;
}

function Stat({
  label,
  result,
  suffix = "件",
}: {
  label: string;
  result: StatResult<number>;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-slate-900">
        {result.ok ? (
          `${result.value.toLocaleString("ja-JP")}${suffix}`
        ) : (
          <span className="text-sm font-medium text-rose-600">取得失敗</span>
        )}
      </dd>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function TournamentDetailView({
  tournament: t,
  stats,
  nowJst,
  canManage,
}: {
  tournament: AdminTournament;
  stats: AdminTournamentStats;
  nowJst: string;
  canManage: boolean;
}) {
  const confirmed = stats.confirmedCount.ok ? stats.confirmedCount.value : null;
  const ratio = confirmed !== null ? formatCapacityRatio(confirmed, t.capacity) : null;
  const draftOverdue = isDraftOverdue(t, nowJst);
  const underCapacity =
    confirmed !== null && isUnderCapacityAlert(t, confirmed, nowJst);

  const actionLink =
    "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/tournaments"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          大会一覧へ
        </Link>
        <h1 className="mt-1 break-words text-xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          ステータス: <span className="font-medium text-slate-800">{STATUS_LABEL[t.status]}</span>
        </p>
      </div>

      {(draftOverdue || underCapacity) && (
        <div className="space-y-2">
          {draftOverdue && (
            <Warning>受付開始日時を過ぎていますが、大会が未公開のままです。</Warning>
          )}
          {underCapacity && (
            <Warning>
              定員未達の警告: 確定エントリー数がアラート閾値（{t.alertThreshold}）を下回っています。
            </Warning>
          )}
        </div>
      )}

      <section aria-labelledby="stats-heading" className="space-y-2">
        <h2 id="stats-heading" className="text-sm font-bold text-slate-900">
          運営状況
        </h2>
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">確定エントリー / 定員</dt>
            <dd className="text-lg font-bold tabular-nums text-slate-900">
              {ratio ? (
                `${ratio.label}（${ratio.percent}%）`
              ) : (
                <span className="text-sm font-medium text-rose-600">取得失敗</span>
              )}
            </dd>
          </div>
          <Stat label="キャンセル待ち" result={stats.waitingCount} />
          <Stat label="請求中のキャンセル" result={stats.billingCancellationCount} />
          <Stat label="入金済み" result={stats.paidCount} />
          <Stat label="未入金" result={stats.unpaidCount} />
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">参加費合計</dt>
            <dd className="text-lg font-bold tabular-nums text-slate-900">
              {confirmed !== null ? (
                yen(totalEntryFee(t.entryFee, confirmed))
              ) : (
                <span className="text-sm font-medium text-rose-600">取得失敗</span>
              )}
            </dd>
          </div>
        </dl>
        <Link
          href={`/admin/tournaments/${t.id}/entries`}
          className={`${actionLink} w-full sm:w-auto`}
        >
          <ListChecks aria-hidden="true" className="h-4 w-4" />
          エントリー状況を見る
        </Link>
      </section>

      {canManage && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={`/admin/tournaments/${t.id}/edit`} className={actionLink}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              編集
            </Link>
            <Link href={`/admin/tournaments/new?copyFrom=${t.id}`} className={actionLink}>
              <Copy aria-hidden="true" className="h-4 w-4" />
              コピーして新規作成
            </Link>
          </div>
          <StatusChangeControl
            tournamentId={t.id}
            title={t.title}
            status={t.status}
            updatedAt={t.updatedAt}
          />
        </div>
      )}

      <section aria-labelledby="info-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="info-heading" className="mb-2 text-sm font-bold text-slate-900">
          大会情報
        </h2>
        <dl>
          <Field label="大会名">{t.title}</Field>
          <Field label="開催日">{t.eventDate}</Field>
          <Field label="種目区分">{CATEGORY_LABEL[t.category]}</Field>
          <Field label="募集階級">{TIER_LABEL[t.tier]}</Field>
          <Field label="会場名">{t.venue}</Field>
          <Field label="コート情報">{text(t.courtInfo)}</Field>
          <Field label="開始時刻">{t.startTime}</Field>
          <Field label="終了時刻">{text(t.endTime)}</Field>
          <Field label="受付開始日時">{t.entryStartAt}</Field>
          <Field label="受付締切日時">{t.entryEndAt}</Field>
          <Field label="定員数">{num(t.capacity, "名")}</Field>
          <Field label="参加費">{yen(t.entryFee)}</Field>
          <Field label="チーム人数（最小）">{num(t.teamSizeMin, "名")}</Field>
          <Field label="チーム人数（最大）">{num(t.teamSizeMax, "名")}</Field>
          <Field label="アラート閾値">{num(t.alertThreshold, "名")}</Field>
          <Field label="景品">{text(t.prize)}</Field>
          <Field label="サーフェス">{t.surface ? SURFACE_LABEL[t.surface] : <Unset />}</Field>
          <Field label="大会シリーズ">{text(t.seriesId)}</Field>
          <Field label="部門の性別区分">
            {t.genderDivision ? GENDER_LABEL[t.genderDivision] : <Unset />}
          </Field>
          <Field label="要項詳細説明">{text(t.description)}</Field>
          <Field label="要項画像">{text(t.imageUrl)}</Field>
          <Field label="ドロー表 URL">{text(t.drawPdfUrl)}</Field>
          <Field label="コピー元の大会">
            {t.copyFromId ? (
              <Link
                href={`/admin/tournaments/${t.copyFromId}`}
                className="text-emerald-700 underline"
              >
                {t.copyFromId}
              </Link>
            ) : (
              <Unset />
            )}
          </Field>
          <Field label="作成日時">{t.createdAt}</Field>
          <Field label="更新日時">{t.updatedAt}</Field>
        </dl>
      </section>
    </div>
  );
}
