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
