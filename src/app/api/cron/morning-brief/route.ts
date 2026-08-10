import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { buildBrief, briefToHtml } from "@/lib/data/brief";

/**
 * Morning Brief cron (PRD §8, §10 — `30 7 * * *`).
 * Sends ONE consolidated digest via Resend. Without RESEND_API_KEY it returns
 * the rendered HTML instead of sending, so the pipeline is testable end-to-end
 * before the key exists. Protect with CRON_SECRET when deployed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Optional shared-secret guard (Vercel Cron sends this header if configured).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const data = await getDashboardData();
  const brief = buildBrief(data);
  const html = briefToHtml(brief);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.MORNING_BRIEF_TO;
  const from = process.env.RESEND_FROM ?? "Diana's OS <brief@dianamarsh.com>";

  if (!apiKey || !to) {
    return NextResponse.json({
      sent: false,
      reason: "RESEND_API_KEY and/or MORNING_BRIEF_TO not set — preview only.",
      subject: brief.title,
      html,
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject: brief.title, html }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ sent: false, error: detail }, { status: 502 });
    }
    return NextResponse.json({ sent: true, subject: brief.title });
  } catch (err) {
    return NextResponse.json(
      { sent: false, error: String(err) },
      { status: 500 },
    );
  }
}
