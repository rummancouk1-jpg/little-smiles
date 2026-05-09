import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { isAuthorizedAdminPage } from "@/lib/admin-auth";
import { currentAdminAuthMode } from "@/lib/admin-identity";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  if (await isAuthorizedAdminPage()) {
    redirect("/admin/orders");
  }

  const params = await searchParams;
  const next = asSingle(params.next) || "/admin/orders";
  const authMode = currentAdminAuthMode();

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-md rounded-3xl border border-[#3B2F2F]/10 bg-white/88 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1F1918]">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
          {authMode === "supabase"
            ? "Sign in with an approved Supabase admin account."
            : "Enter admin password to access order operations and intent review."}
        </p>
        <AdminLoginForm nextPath={next} authMode={authMode} />
      </section>
    </main>
  );
}
