// ログイン画面（/login）。
// 既にログイン済みならホームへ飛ばす。
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthBrandHeader } from "@/features/auth/components/AuthBrandHeader";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md mx-auto">
        <AuthBrandHeader subtitle="北海道テニス大会「GRAN」公式アプリ" />
        <LoginForm />
      </div>
      <footer className="pt-8 text-center text-xs text-slate-400">
        <p>&copy; 2026 GRAN Tennis Tournament Platform.</p>
      </footer>
    </main>
  );
}
