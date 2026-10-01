// ログインフォーム（クライアントコンポーネント）。
// Server Action(loginAction) を useActionState で呼び出し、
// 成功時はサーバー側で / へ redirect される。
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginAction, type AuthActionState } from "@/features/auth/server/actions";

const initialState: AuthActionState = { ok: false };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
      {/* 全体エラー表示 */}
      {state.message && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{state.message}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* ログインID / メール */}
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            ログインID / メールアドレス
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </span>
            <input
              type="text"
              id="identifier"
              name="identifier"
              defaultValue={state.values?.identifier ?? ""}
              placeholder="000101 または sample@example.com"
              className="w-full h-11 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 transition"
            />
          </div>
          {fieldErrors.identifier && (
            <p className="text-xs text-rose-600 mt-1">{fieldErrors.identifier}</p>
          )}
        </div>

        {/* パスワード */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            パスワード
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder="••••••••"
              className="w-full h-11 pl-9 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-rose-600 mt-1">{fieldErrors.password}</p>
          )}
        </div>

        <Button type="submit" size="full" isLoading={isPending}>
          <span>ログイン</span>
          {!isPending && <ArrowRight className="w-4 h-4 ml-1" />}
        </Button>
      </form>

      {/* 新規登録リンク */}
      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          アカウントをまだお持ちでない方は→
          <Link
            href="/register"
            className="text-emerald-600 hover:text-emerald-700 font-semibold ml-1"
          >
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
