import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { updateDraftHeroImage } from "@/lib/contentops/drafts-store";
import { isAllowedHeroImagePath } from "@/lib/contentops/hero-image";
import { captureServerError } from "@/lib/error-observability";

type RouteProps = {
  params: Promise<{ id: string }>;
};

type RequestBody = {
  /** Pass `null` to clear the reviewer override and fall back to auto-resolve. */
  heroImagePath?: string | null;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = body?.heroImagePath;
  const next: string | null =
    raw === null || raw === undefined ? null : typeof raw === "string" ? raw.trim() : "";

  if (next !== null && next.length > 0 && !isAllowedHeroImagePath(next)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Hero image path is not allowed. Must be one of the catalog product image paths in lib/products.ts.",
      },
      { status: 400 },
    );
  }

  try {
    const draft = await updateDraftHeroImage(id, next === null || next.length === 0 ? null : next);
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update hero image";
    captureServerError(
      "api_admin_contentops_hero_image_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
