import { NextResponse } from "next/server";
import { isRechatConfigured, syncFromRechat } from "@/lib/integrations/rechat";

/**
 * Rechat sync trigger (PRD §10 — polled every 15 min as a webhook backup, and
 * callable on demand). Protect with CRON_SECRET when deployed. Safe no-op with
 * an explanatory message until Rechat credentials are set.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!isRechatConfigured()) {
    return NextResponse.json({
      synced: false,
      reason:
        "Rechat not configured. Set RECHAT_CLIENT_ID / RECHAT_CLIENT_SECRET to enable sync.",
    });
  }

  try {
    const counts = await syncFromRechat();
    return NextResponse.json({ synced: true, counts });
  } catch (err) {
    return NextResponse.json(
      { synced: false, error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
