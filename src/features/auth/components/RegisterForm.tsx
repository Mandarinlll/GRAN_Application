// 新規登録フォーム（クライアントコンポーネント）。
// Server Action(registerAction) を useActionState で呼び出す。
// 成功時はサーバー側でセッション発行のうえ / へ redirect される。
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Key,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Calendar,
  Award,
  Gauge,
  Info,
  AlertCircle,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  registerAction,
  type AuthActionState,
} from "@/features/auth/server/actions";
import type { DeclaredClass } from "@/types/user";

const initialState: AuthActionState = { ok: false };

// 申告階級ごとの査定レンジ案内（register.html の classGuidanceMap 準拠）。
const CLASS_GUIDANCE: Record<
  DeclaredClass,
  { label: string; range: string; desc: string }
> = {
  A: {
    label: "A 級",
    range: "850 〜 999 pt",
    desc: "最上級者階級です。インカレ・全日本各種大会に出場経験がある方やコーチ経験がある方等",
  },
  AB: {
    label: "AB 級",
    range: "750 〜 870 pt",
    desc: "市民大会や北海道予選などの公式大会にA・B級で出場されている方",
  },
  B: {
    label: "B 級",
    range: "650 〜 770 pt",
    desc: "市民大会や北海道予選などの公式大会にA・B級で出場されている方",
  },
  BC: {
    label: "BC 級",
    range: "550 〜 670 pt",
    desc: "草トー上級、市民大会B級上位などの中級上位階級です。",
  },
  C: {
    label: "C 級",
    range: "450 〜 570 pt",
    desc: "本大会の標準階級です。市民大会B/C級、一般草トーナメント中級レベルの方",
  },
  CD: {
    label: "CD 級",
    range: "350 〜 470 pt",
    desc: "スクール中級レベル、草トー初中級クラスなどの初中級上位階級です。",
  },
  D: {
    label: "D 級",
    range: "250 〜 370 pt",
    desc: "スクール初中級、大会出場経験が数回程度の初中級階級です。",
  },
  DE: {
    label: "DE 級",
    range: "100 〜 270 pt",
    desc: "大会初参加、ビギナー・スクール初級クラスなどのエントリー階級です。",
  },
};

const CLASS_ORDER: DeclaredClass[] = ["A", "AB", "B", "BC", "C", "CD", "D", "DE"];

// 入力欄共通クラス。
const inputBase =
  "w-full h-11 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 transition";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<DeclaredClass>(
    (state.values?.declaredClass as DeclaredClass) ?? "C",
  );

  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const guidance = CLASS_GUIDANCE[selectedClass];

  return (
    <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
      {state.message && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{state.message}</span>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* セクション1: ログイン認証情報 */}
        <section className="space-y-4">
          <SectionTitle icon={<Key className="w-4 h-4 text-emerald-600" />}>
            ログイン認証情報
          </SectionTitle>

          <Field label="メールアドレス" required error={fieldErrors.email}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                name="email"
                defaultValue={values.email ?? ""}
                placeholder="player@example.com"
                className={`${inputBase} pl-9`}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              ※ ログインIDとして使用されます
            </p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="パスワード" required error={fieldErrors.password}>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="8文字以上の英数字"
                  className={`${inputBase} pl-9 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="パスワード表示切替"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </Field>

            <Field
              label="パスワード（確認用）"
              required
              error={fieldErrors.passwordConfirm}
            >
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  name="passwordConfirm"
                  placeholder="再入力してください"
                  className={`${inputBase} pl-9 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label="確認用パスワード表示切替"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </Field>
          </div>
        </section>

        {/* セクション2: 基本情報 */}
        <section className="space-y-4">
          <SectionTitle icon={<UserCheck className="w-4 h-4 text-emerald-600" />}>
            基本情報（本人確認・運営用）
          </SectionTitle>

          <div className="grid grid-cols-2 gap-3">
            <Field label="姓 (本名)" required error={fieldErrors.lastName}>
              <input
                type="text"
                name="lastName"
                defaultValue={values.lastName ?? ""}
                placeholder="田中"
                className={inputBase}
              />
            </Field>
            <Field label="名 (本名)" required error={fieldErrors.firstName}>
              <input
                type="text"
                name="firstName"
                defaultValue={values.firstName ?? ""}
                placeholder="太郎"
                className={inputBase}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="セイ (フリガナ)" required error={fieldErrors.lastKana}>
              <input
                type="text"
                name="lastKana"
                defaultValue={values.lastKana ?? ""}
                placeholder="タナカ"
                className={inputBase}
              />
            </Field>
            <Field label="メイ (フリガナ)" required error={fieldErrors.firstKana}>
              <input
                type="text"
                name="firstKana"
                defaultValue={values.firstKana ?? ""}
                placeholder="タロウ"
                className={inputBase}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="性別" required error={fieldErrors.gender}>
              <div className="grid grid-cols-2 gap-2 h-11">
                <label className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-700 font-medium text-xs">
                  <input
                    type="radio"
                    name="gender"
                    value="MALE"
                    defaultChecked={
                      (values.gender ?? "MALE") === "MALE"
                    }
                    className="accent-emerald-600"
                  />
                  <span>男性</span>
                </label>
                <label className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-700 font-medium text-xs">
                  <input
                    type="radio"
                    name="gender"
                    value="FEMALE"
                    defaultChecked={values.gender === "FEMALE"}
                    className="accent-emerald-600"
                  />
                  <span>女性</span>
                </label>
              </div>
            </Field>

            <Field label="生年月日" required error={fieldErrors.birthDate}>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  name="birthDate"
                  defaultValue={values.birthDate ?? ""}
                  className={`${inputBase} pl-9`}
                />
              </div>
            </Field>
          </div>

          <Field label="電話番号（任意）" error={fieldErrors.phoneNumber}>
            <input
              type="tel"
              name="phoneNumber"
              defaultValue={values.phoneNumber ?? ""}
              placeholder="090-1234-5678"
              className={inputBase}
            />
          </Field>
        </section>

        {/* セクション3: 公開プロフィール */}
        <section className="space-y-4">
          <SectionTitle icon={<UserIcon className="w-4 h-4 text-emerald-600" />}>
            大会公開プロフィール
          </SectionTitle>

          <Field label="ニックネーム" required error={fieldErrors.nickname}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                name="nickname"
                defaultValue={values.nickname ?? ""}
                placeholder="テニスタロウ"
                className={`${inputBase} pl-9`}
              />
            </div>
            <div className="mt-1.5 p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2 text-[11px] text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                外部公開用（対戦表・ドロー表）の資料に掲載されます。本名やメールアドレスなどの個人情報を含めることはお控えください。
              </span>
            </div>
          </Field>
        </section>

        {/* セクション4: テニス階級自己申告 */}
        <section className="space-y-4">
          <SectionTitle icon={<Award className="w-4 h-4 text-emerald-600" />}>
            エントリー階級自己申告 (GRANレベル)
          </SectionTitle>

          <Field
            label="もっともよく出場する階級"
            required
            error={fieldErrors.declaredClass}
          >
            <select
              name="declaredClass"
              value={selectedClass}
              onChange={(e) =>
                setSelectedClass(e.target.value as DeclaredClass)
              }
              className={`${inputBase} font-medium`}
            >
              {CLASS_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CLASS_GUIDANCE[c].label}
                </option>
              ))}
            </select>
          </Field>

          {/* 査定レンジ案内カード */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-600" />
                申告階級の査定基準レンジ
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[11px]">
                {guidance.range}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {guidance.desc}
            </p>
            <div className="pt-2 border-t border-emerald-200 flex items-start gap-1.5 text-[10.5px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                ※ 登録時は申告をもとに運営事務局が初期GRANレベル（100〜999）を査定します。登録直後は「未査定」状態となり、大会結果に応じてレートが更新されます。
              </span>
            </div>
          </div>
        </section>

        {/* 利用規約同意 */}
        <div className="space-y-1 pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
            <input
              type="checkbox"
              name="agree"
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
            />
            <span>
              <span className="text-emerald-600 font-medium">利用規約</span>
              および
              <span className="text-emerald-600 font-medium">
                プライバシーポリシー
              </span>
              に同意します
            </span>
          </label>
          {fieldErrors.agree && (
            <p className="text-xs text-rose-600">{fieldErrors.agree}</p>
          )}
        </div>

        <Button type="submit" size="full" isLoading={isPending}>
          <span>アカウントを作成して登録</span>
          {!isPending && <ArrowRight className="w-4 h-4 ml-1" />}
        </Button>
      </form>

      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          すでにアカウントをお持ちですか？
          <Link
            href="/login"
            className="text-emerald-600 hover:text-emerald-700 font-semibold ml-1"
          >
            ログインはこちら
          </Link>
        </p>
      </div>
    </div>
  );
}

// ---- ローカル小コンポーネント ----

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
      {icon}
      <h3 className="text-xs font-bold text-slate-700 tracking-wide uppercase">
        {children}
      </h3>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}
