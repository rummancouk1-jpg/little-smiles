"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_LOGOUT_CLASS =
  "rounded-full border border-[#3B2F2F]/14 bg-[#F2E8DE] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#EADFD4] disabled:cursor-not-allowed disabled:opacity-70";

/** Sign-out control. Logic is fixed; only the styling is themeable via
 *  `className` so the dark cockpit command bar can reuse it. */
export function AdminLogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={loading}
      className={className ?? DEFAULT_LOGOUT_CLASS}
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
