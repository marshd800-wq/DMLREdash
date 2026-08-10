import { NextResponse } from "next/server";
import { buildAuthorizeUrl, getRechatConfig } from "@/lib/integrations/rechat";

/**
 * Rechat "Connect" entry point. Diana visits this once; it redirects her browser
 * to the Rechat web app to log in and pick her brand. Rechat then redirects back
 * to /api/auth/rechat/callback with an authorization code.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getRechatConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Rechat not configured. Set RECHAT_CLIENT_ID / RECHAT_CLIENT_SECRET." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(buildAuthorizeUrl(config));
}
