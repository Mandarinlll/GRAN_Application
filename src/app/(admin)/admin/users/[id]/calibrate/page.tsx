// 初期レベル査定（URL: /admin/users/{id}/calibrate）。accounts.manage を持つ ADMIN のみ。
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/server/guard";
import { getUserDetail } from "@/features/accounts/server/userQueryService";
import { CalibrateForm } from "@/features/accounts/components/CalibrateForm";
import { CALIBRATION_RANGE } from "@/features/accounts/utils/calibration";

export const dynamic = "force-dynamic";

export default async function AdminUserCalibratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("accounts.manage");
  const { id } = await params;
  const result = await getUserDetail(id);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <div className="mx-auto max-w-2xl">
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          ユーザー情報を取得できませんでした。{result.message}
        </p>
      </div>
    );
  }

  const u = result.data;
  const range = u.declaredClass ? CALIBRATION_RANGE[u.declaredClass] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <Link
        href={`/admin/users/${u.id}`}
        className="inline-flex min-h-[44px] items-center text-sm text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        ← ユーザー詳細へ戻る
      </Link>
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">初期レベル査定</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-900">
          {u.realName}（{u.loginId}）
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[13px] text-slate-600">申告階級</dt>
            <dd className="font-medium text-slate-900">{u.declaredClass ?? "未設定"}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-slate-600">現在の Gran_Level</dt>
            <dd className="font-medium tabular-nums text-slate-900">
              {u.granLevel}
              <span className="ml-2 text-[13px] font-normal text-slate-600">
                {u.isLevelCalibrated ? "査定済" : "未査定"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-slate-600">査定レンジ</dt>
            <dd className="font-medium tabular-nums text-slate-900">
              {range ? `${range[0]}〜${range[1]}` : "未設定"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <CalibrateForm
          userId={u.id}
          declaredClass={u.declaredClass}
          currentLevel={u.granLevel}
          range={range}
        />
      </section>
    </div>
  );
}
