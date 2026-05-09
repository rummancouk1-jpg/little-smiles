"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
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
      className="rounded-full border border-[#3B2F2F]/14 bg-[#F2E8DE] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#EADFD4] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
