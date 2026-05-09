"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

type AdminLoginFormProps = {
  nextPath: string;
  authMode: "secret" | "supabase";
};

export function AdminLoginForm({ nextPath, authMode }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authMode === "supabase" ? email : undefined,
          password,
        }),
      });
      if (!response.ok) {
        if (response.status === 429) {
          const data = (await response.json().catch(() => null)) as { retryAfterSeconds?: number } | null;
          const retry = data?.retryAfterSeconds;
          setError(
            retry
              ? `Too many attempts. Try again in ${retry} seconds.`
              : "Too many attempts. Please try again later.",
          );
        } else {
          setError("Invalid credentials. Please try again.");
        }
        setLoading(false);
        return;
      }
      router.replace(nextPath.startsWith("/") ? nextPath : "/admin/orders");
      router.refresh();
    } catch {
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      {authMode === "supabase" ? (
        <>
          <label className="block text-sm font-medium text-[#2E2323]" htmlFor="admin-email">
            Admin Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="admin@littlesmiles.co.uk"
            className="h-11 w-full rounded-2xl border border-[#2E2323]/14 bg-white px-3 text-sm text-[#2E2323] outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/20"
          />
        </>
      ) : null}
      <label className="block text-sm font-medium text-[#2E2323]" htmlFor="admin-password">
        Admin Password
      </label>
      <input
        id="admin-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        className="h-11 w-full rounded-2xl border border-[#2E2323]/14 bg-white px-3 text-sm text-[#2E2323] outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/20"
      />
      <button
        type="submit"
        disabled={loading || password.length === 0 || (authMode === "supabase" && email.trim().length === 0)}
        className="h-11 w-full rounded-full bg-[#2F2624] px-5 text-sm font-medium text-[#F6F1EC] transition-colors hover:bg-[#251E1D] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error ? <p className="text-sm text-[#9A4C5A]">{error}</p> : null}
    </form>
  );
}
