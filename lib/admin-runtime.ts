import { currentAdminAuthMode } from "@/lib/admin-identity";

export function isAdminAuthConfigured(): boolean {
  const mode = currentAdminAuthMode();
  if (mode === "supabase") {
    return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
  }
  return Boolean(process.env.ADMIN_SECRET?.trim());
}

export function adminConfigHelpText(): string {
  const mode = currentAdminAuthMode();
  if (mode === "supabase") {
    return "`SUPABASE_URL` and `SUPABASE_ANON_KEY` are required for admin login in Supabase auth mode.";
  }
  return "`ADMIN_SECRET` is missing. Set it in environment variables to enable admin login.";
}
