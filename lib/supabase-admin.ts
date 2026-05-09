import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
