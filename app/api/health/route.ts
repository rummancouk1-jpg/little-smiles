import { NextResponse } from "next/server";

/**
 * Lightweight uptime check for monitors (UptimeRobot, Better Stack, etc.).
 * No secrets; safe to expose publicly.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "little-smiles",
      time: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
