// 新規登録画面（/register）。
// 既にログイン済みならホームへ飛ばす。
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthBrandHeader } from "@/features/auth/components/AuthBrandHeader";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8 sm:py-10">
      <div className="w-full max-w-xl mx-auto">
        <AuthBrandHeader subtitle="新規アカウント登録" />
        <RegisterForm />
      </div>
      <footer className="pt-8 text-center text-xs text-slate-400">
        <p>&copy; 2026 GRAN Tennis Tournament Platform.</p>
      </footer>
    </main>
  );
}
