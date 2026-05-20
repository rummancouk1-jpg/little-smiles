import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/admin-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AuditPayload = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAdminAudit(request: Request, payload: AuditPayload): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const session = getAdminSessionFromRequest(request);

  const userAgent = request.headers.get("user-agent");

  await supabase.from("admin_audit_logs").insert([
    {
      actor_label: session?.actorLabel ?? "admin_session",
      action: payload.action,
      target_type: payload.targetType ?? null,
      target_id: payload.targetId ?? null,
      ip_address: getClientIp(request),
      user_agent: userAgent && userAgent.length > 0 ? userAgent.slice(0, 512) : null,
      metadata: payload.metadata ?? null,
    },
  ]);
}

/**
 * Request-free audit row. Used by Vercel Cron handlers and other automated
 * jobs where there is no admin session / client request to attribute the
 * action to. Silently no-ops when Supabase is not configured so cron paths
 * stay resilient on partial environments.
 */
export async function logSystemAudit(payload: AuditPayload & { actorLabel?: string }): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from("admin_audit_logs").insert([
    {
      actor_label: payload.actorLabel?.trim() || "system_cron",
      action: payload.action,
      target_type: payload.targetType ?? null,
      target_id: payload.targetId ?? null,
      ip_address: null,
      user_agent: null,
      metadata: payload.metadata ?? null,
    },
  ]);
}
