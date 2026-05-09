import { NextResponse } from "next/server";

import { getSupabaseAdminClient, getSupabaseRuntimeChecks } from "@/lib/supabase-admin";

/**
 * Temporary diagnostics endpoint for Supabase order-intent setup.
 * Returns safe configuration/connection status only (never secrets).
 */
export async function GET() {
  const checks = getSupabaseRuntimeChecks();
  const supabase = getSupabaseAdminClient();

  let canConnectToSupabase = false;
  let canInsertTestOrderIntent = false;
  let insertErrorCode: string | null = null;
  let insertErrorMessage: string | null = null;

  if (supabase) {
    const { error: connectError } = await supabase
      .from("order_intents")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    canConnectToSupabase = !connectError;

    const { error: insertError } = await supabase.from("order_intents").insert({
      product_slug: "diagnostic-test",
      product_name: "Diagnostic Test",
      category: "debug",
      price_pkr: 0,
      source_page: "/api/order-intent/health",
      event_timestamp: new Date().toISOString(),
      user_agent: "diagnostic-health-check",
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      insertErrorCode = insertError.code ?? null;
      insertErrorMessage = insertError.message ?? "insert failed";
    } else {
      canInsertTestOrderIntent = true;
    }
  }

  return NextResponse.json({
    hasSupabaseUrl: checks.hasUrl,
    hasServiceRoleKey: checks.hasServiceRoleKey,
    isSupabaseUrlValid: checks.urlIsValid,
    supabaseHost: checks.urlHost ?? null,
    canConnectToSupabase,
    canInsertTestOrderIntent,
    insertErrorCode,
    insertErrorMessage,
  });
}
