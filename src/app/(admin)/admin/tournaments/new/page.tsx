// 大会の登録・コピー作成（URL: /admin/tournaments/new?copyFrom={id}）。ADMIN のみ。
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/server/guard";
import { findAdminTournamentById } from "@/features/tournaments/server/tournamentAdminRepository";
import { buildCopyDefaults } from "@/features/tournaments/utils/copyDefaults";
import { parseImageKey } from "@/features/tournaments/utils/adminImageUrl";
import { TournamentForm, EMPTY_FORM_VALUES } from "@/features/tournaments/components/admin/TournamentForm";
import { toFormValues } from "@/features/tournaments/components/admin/formValues";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ copyFrom?: string | string[] }>;
}) {
  await requireAdminPage("tournaments.manage");
  const sp = await searchParams;
  const copyFrom = Array.isArray(sp.copyFrom) ? sp.copyFrom[0] : sp.copyFrom;

  let initialValues = EMPTY_FORM_VALUES;
  let existingImageUrl: string | null = null;

  if (copyFrom !== undefined) {
    if (!UUID_RE.test(copyFrom)) notFound();
    const source = findAdminTournamentById(copyFrom);
    if (!source) notFound();
    const defaults = buildCopyDefaults(source);
    initialValues = toFormValues(defaults);
    // 管理対象外（シードの外部 URL など）の画像は複製できないため画像欄を空にする
    existingImageUrl = parseImageKey(defaults.imageUrl) ? defaults.imageUrl : null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <h1 className="text-lg font-bold text-slate-900">
        {copyFrom ? "大会をコピーして登録" : "大会を登録"}
      </h1>
      {copyFrom ? (
        <p className="text-sm text-slate-600">
          コピー元の内容を引き継いでいます。開催日・時刻・受付日時は新しく入力してください。
        </p>
      ) : null}
      <TournamentForm
        mode="create"
        initialValues={initialValues}
        copyFromId={copyFrom}
        existingImageUrl={existingImageUrl}
        cancelHref="/admin/tournaments"
      />
    </div>
  );
}
