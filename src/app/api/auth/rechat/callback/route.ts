import { NextResponse } from "next/server";
import { exchangeCodeForTokens, getRechatConfig, syncFromRechat } from "@/lib/integrations/rechat";

/**
 * Rechat OAuth callback. Receives ?code & ?brand from the Rechat web app,
 * exchanges the code for tokens (stored in Supabase), kicks off a first sync,
 * then sends Diana back to the dashboard.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const config = getRechatConfig();
  const origin = new URL(request.url).origin;
  if (!config) {
    return NextResponse.json({ error: "Rechat not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const brand = searchParams.get("brand");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/?rechat=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?rechat=error&reason=missing_code`);
  }

  try {
    await exchangeCodeForTokens(config, code, brand);
    // Best-effort first sync so data shows up immediately; ignore its failure.
    try {
      await syncFromRechat();
    } catch {
      /* the scheduled cron will retry */
    }
    return NextResponse.redirect(`${origin}/?rechat=connected`);
  } catch (err) {
    const reason = encodeURIComponent(String(err instanceof Error ? err.message : err));
    return NextResponse.redirect(`${origin}/?rechat=error&reason=${reason}`);
  }
}
