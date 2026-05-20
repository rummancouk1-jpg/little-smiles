import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { BlogPost } from "@/lib/contentops/blog-schema";

type OrderIntentsTable = {
  id: string;
  product_slug: string | null;
  product_name: string | null;
  category: string | null;
  price_pkr: number | null;
  source_page: string;
  event_timestamp: string;
  user_agent: string | null;
  created_at: string;
};

type OrdersTable = {
  id: string;
  customer_id: string | null;
  source_intent_id: string | null;
  product_slug: string;
  product_name: string;
  category: string;
  price_pkr: number;
  quantity: number;
  status: "new_intent" | "contacted" | "confirmed" | "dispatched" | "delivered" | "cancelled";
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  address_note: string | null;
  delivery_fee_pkr: number;
  total_pkr: number;
  courier: string | null;
  tracking_id: string | null;
  payment_method: "cod" | "bank_transfer" | "easypaisa" | "jazzcash" | "other" | null;
  paid_status: "unpaid" | "partial" | "paid";
  details_completed_at: string | null;
  source_page: string | null;
  intent_timestamp: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CustomersTable = {
  id: string;
  full_name: string;
  phone: string;
  city: string | null;
  address_note: string | null;
  created_at: string;
  updated_at: string;
};

type OrderStatusHistoryTable = {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
};

type AdminAuditLogsTable = {
  id: string;
  actor_label: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type OrderCommunicationsTable = {
  id: string;
  order_id: string;
  event_type: "order_confirmed" | "order_dispatched" | "order_delivered" | "order_cancelled";
  channel: "whatsapp" | "sms";
  recipient_phone: string | null;
  message_preview: string | null;
  delivery_status: "queued" | "sent" | "failed";
  provider_response: Record<string, unknown> | null;
  idempotency_key: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

type ContentopsDraftsTable = {
  id: string;
  slug: string;
  status: "pending_review" | "approved" | "rejected" | "published" | "scheduled";
  content: BlogPost;
  rejection_note: string | null;
  publish_notes: string | null;
  approved_at: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  manually_edited: boolean;
  last_edited_at: string | null;
  ai_generated_content: BlogPost | null;
  previous_content: BlogPost | null;
  created_at: string;
  updated_at: string;
};

type ContentopsNotificationPreferencesTable = {
  id: string;
  digest_enabled: boolean;
  digest_recipient_email: string | null;
  skip_empty_digests: boolean;
  created_at: string;
  updated_at: string;
};

type ContentopsTopicsTable = {
  id: string;
  title: string;
  intent: "informational" | "commercial" | "transactional";
  related_category: string | null;
  priority: "high" | "medium" | "low";
  competition: "low" | "medium" | "high";
  seasonality: "evergreen" | "summer" | "winter" | "monsoon" | "eid";
  trend: "rising" | "steady" | "declining";
  suggested_window_start: string | null;
  suggested_window_end: string | null;
  status: "queued" | "drafted" | "published" | "archived" | "snoozed";
  draft_id: string | null;
  source: "manual" | "seed";
  notes: string | null;
  content_angle: string | null;
  suggested_cta: string | null;
  confidence_score: number | null;
  snoozed_until: string | null;
  format:
    | "guide"
    | "comparison"
    | "faq"
    | "checklist"
    | "seasonal"
    | "beginner"
    | "best_for"
    | "problem_solution"
    | null;
  cluster:
    | "Sleep"
    | "Feeding"
    | "Wardrobe"
    | "Outings"
    | "Gifting"
    | "Newborn Care"
    | null;
  seasonal_relevance: number | null;
  created_at: string;
  updated_at: string;
};

type SupabaseSchema = {
  public: {
    Tables: {
      order_intents: {
        Row: OrderIntentsTable;
        Insert: Omit<OrderIntentsTable, "id" | "created_at"> & {
          created_at?: string;
        };
        Update: Partial<OrderIntentsTable>;
        Relationships: [];
      };
      orders: {
        Row: OrdersTable;
        Insert: Omit<OrdersTable, "id" | "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<OrdersTable>;
        Relationships: [];
      };
      customers: {
        Row: CustomersTable;
        Insert: Omit<CustomersTable, "id" | "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CustomersTable>;
        Relationships: [];
      };
      order_status_history: {
        Row: OrderStatusHistoryTable;
        Insert: Omit<OrderStatusHistoryTable, "id" | "changed_at"> & {
          changed_at?: string;
        };
        Update: Partial<OrderStatusHistoryTable>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLogsTable;
        Insert: Omit<AdminAuditLogsTable, "id" | "created_at"> & {
          created_at?: string;
        };
        Update: Partial<AdminAuditLogsTable>;
        Relationships: [];
      };
      order_communications: {
        Row: OrderCommunicationsTable;
        Insert: Omit<OrderCommunicationsTable, "id" | "created_at"> & {
          created_at?: string;
        };
        Update: Partial<OrderCommunicationsTable>;
        Relationships: [];
      };
      contentops_drafts: {
        Row: ContentopsDraftsTable;
        Insert: Omit<ContentopsDraftsTable, "id" | "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ContentopsDraftsTable>;
        Relationships: [];
      };
      contentops_topics: {
        Row: ContentopsTopicsTable;
        Insert: Omit<ContentopsTopicsTable, "id" | "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ContentopsTopicsTable>;
        Relationships: [];
      };
      contentops_notification_preferences: {
        Row: ContentopsNotificationPreferencesTable;
        Insert: Omit<ContentopsNotificationPreferencesTable, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ContentopsNotificationPreferencesTable>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: SupabaseClient<SupabaseSchema> | null | undefined;

export type SupabaseRuntimeChecks = {
  hasUrl: boolean;
  hasServiceRoleKey: boolean;
  urlIsValid: boolean;
  urlHost?: string;
  normalizedUrl?: string;
  hadPathSuffix: boolean;
};

function parseSupabaseBaseUrl(rawUrl: string): {
  urlIsValid: boolean;
  urlHost?: string;
  normalizedUrl?: string;
  hadPathSuffix: boolean;
} {
  try {
    const parsed = new URL(rawUrl);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    const hadPathSuffix = normalizedPath !== "";
    return {
      urlIsValid: true,
      urlHost: parsed.host,
      normalizedUrl: parsed.origin,
      hadPathSuffix,
    };
  } catch {
    return {
      urlIsValid: false,
      hadPathSuffix: false,
    };
  }
}

export function getSupabaseRuntimeChecks(): SupabaseRuntimeChecks {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const hasUrl = Boolean(rawUrl);
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  if (!rawUrl) {
    return {
      hasUrl,
      hasServiceRoleKey,
      urlIsValid: false,
      hadPathSuffix: false,
    };
  }

  const parsed = parseSupabaseBaseUrl(rawUrl);
  return {
    hasUrl,
    hasServiceRoleKey,
    urlIsValid: parsed.urlIsValid,
    urlHost: parsed.urlHost,
    normalizedUrl: parsed.normalizedUrl,
    hadPathSuffix: parsed.hadPathSuffix,
  };
}

/**
 * Creates a server-side Supabase client using service role credentials.
 * Returns null when env vars are missing so API handlers can gracefully fallback.
 */
export function getSupabaseAdminClient(): SupabaseClient<SupabaseSchema> | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const checks = getSupabaseRuntimeChecks();

  if (!url || !serviceRoleKey || !checks.urlIsValid || !checks.normalizedUrl) {
    client = null;
    return client;
  }

  // Always use the base project URL (origin). This prevents PGRST125 from
  // malformed URLs such as ".../rest/v1" being passed as SUPABASE_URL.
  client = createClient<SupabaseSchema>(checks.normalizedUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
