import { NextResponse } from "next/server";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { updateDraftHeroImage } from "@/lib/contentops/drafts-store";
import { resolveHeroImagePathAcceptance } from "@/lib/contentops/hero-image";
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

  let acceptanceReason: "catalog" | "uploaded" | null = null;
  if (next !== null && next.length > 0) {
    const acceptance = await resolveHeroImagePathAcceptance(next);
    if (!acceptance.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Hero image path rejected: ${acceptance.error}`,
        },
        { status: 400 },
      );
    }
    acceptanceReason = acceptance.reason;
  }

  try {
    const finalPath = next === null || next.length === 0 ? null : next;
    const draft = await updateDraftHeroImage(id, finalPath);
    await logAdminAudit(request, {
      action: "contentops_hero_image_change",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: { slug: draft.slug, heroImagePath: finalPath, acceptance: acceptanceReason },
    }).catch(() => {});
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
