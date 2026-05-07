import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Canonical host is www.littlesmiles.co (matches metadataBase).
 * 301 apex → www for SEO consolidation (skipped on localhost & previews).
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host === "littlesmiles.co") {
    const url = request.nextUrl.clone();
    url.hostname = "www.littlesmiles.co";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|txt|xml)$).*)",
  ],
};
