import { NextResponse } from "next/server";
import crypto from "crypto";
import { getRechatConfig, upsertRechatRecord } from "@/lib/integrations/rechat";

/**
 * Rechat webhook receiver (PRD §7 — real-time contacts/deals/listings events).
 * Give Rechat this URL: https://<your-domain>/api/webhooks/rechat
 *
 * Verifies an HMAC-SHA256 signature over the raw body using RECHAT_WEBHOOK_SECRET,
 * then upserts the changed record. The exact header name + signing scheme should
 * be confirmed against Rechat's webhook docs; adjust SIGNATURE_HEADER if needed.
 */
export const dynamic = "force-dynamic";

const SIGNATURE_HEADER = "x-rechat-signature";

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!secret) return true; // no secret configured yet → accept (dev only)
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time compare; tolerate a "sha256=" prefix if Rechat sends one.
  const provided = signature.replace(/^sha256=/, "");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const config = getRechatConfig();
  if (!config) {
    return NextResponse.json({ ok: false, reason: "Rechat not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!verifySignature(rawBody, signature, config.webhookSecret)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Expected shape: { type|resource_type, object|data|resource }. Adjust to match
  // Rechat's real event envelope once confirmed.
  const resource = String(
    (payload.resource_type ?? payload.type ?? payload.object_type ?? "") as string,
  ).toLowerCase();
  const object = (payload.object ?? payload.data ?? payload.resource ?? payload) as Record<
    string,
    unknown
  >;

  try {
    await upsertRechatRecord(resource, object);
    return NextResponse.json({ ok: true, resource });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
