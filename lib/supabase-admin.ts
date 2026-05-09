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

/**
 * Creates a server-side Supabase client using service role credentials.
 * Returns null when env vars are missing so API handlers can gracefully fallback.
 */
export function getSupabaseAdminClient(): SupabaseClient<SupabaseSchema> | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    client = null;
    return client;
  }

  client = createClient<SupabaseSchema>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
