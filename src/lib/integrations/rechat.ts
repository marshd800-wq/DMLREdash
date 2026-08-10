/**
 * ─────────────────────────────────────────────────────────────
 *  RECHAT INTEGRATION STUB  (PRD §7 — primary CRM / source of truth)
 * ─────────────────────────────────────────────────────────────
 *
 * Rechat is Diana's system of record. Diana's OS does NOT rebuild Rechat — it
 * reads/writes via the Rechat API + webhooks and surfaces everything on one
 * screen. This file is the seam where that sync lands in Phase 1+.
 *
 * WHAT TO BUILD HERE (Phase 1 = READ):
 *   - Auth: RECHAT_API_KEY (confirm OAuth vs. key at docs.api.rechat.com).
 *   - Pull: contacts, deals, listings, tasks, documents/e-sign status, showings.
 *   - Upsert into Supabase deduped on `rechat_id` (never create duplicates).
 *   - Webhooks (real-time): a route at /api/webhooks/rechat verifies
 *     RECHAT_WEBHOOK_SECRET, then upserts the changed record.
 *   - Cron backup: poll every 15 min in case a webhook is missed.
 *
 * Until this is wired, getDashboardData() falls back to Supabase or sample data,
 * so the dashboard is fully usable today.
 */

export interface RechatConfig {
  apiKey: string;
  apiBase: string;
  webhookSecret: string;
}

export function getRechatConfig(): RechatConfig | null {
  const apiKey = process.env.RECHAT_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    apiBase: process.env.RECHAT_API_BASE ?? "https://api.rechat.com",
    webhookSecret: process.env.RECHAT_WEBHOOK_SECRET ?? "",
  };
}

export function isRechatConfigured(): boolean {
  return Boolean(process.env.RECHAT_API_KEY);
}

/** Phase 1: fetch + upsert contacts/deals/listings from Rechat. TODO. */
export async function syncFromRechat(): Promise<{ synced: number }> {
  const config = getRechatConfig();
  if (!config) {
    throw new Error(
      "Rechat is not configured. Set RECHAT_API_KEY to enable live sync.",
    );
  }
  // TODO(phase-1): GET /contacts, /deals, /listings from config.apiBase using
  // the Bearer key, map to Supabase rows, upsert on rechat_id. See PRD §3/§7.
  throw new Error("Rechat sync not implemented yet — integration stub.");
}
