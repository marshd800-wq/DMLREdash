/**
 * ─────────────────────────────────────────────────────────────
 *  RECHAT INTEGRATION  (PRD §7 — primary CRM / source of truth)
 * ─────────────────────────────────────────────────────────────
 *
 * Reads contacts / deals / listings from Rechat and upserts them into Supabase,
 * deduped on `rechat_id` so people/properties are never duplicated. Auth is
 * OAuth 2.0 (partners use the OAuth process; ClientPassword is Rechat-internal).
 *
 * Field mapping lives in rechatMap.ts (the one file to finalize against a real
 * payload). This file is payload-agnostic: auth, paginated fetch, FK resolution,
 * and upsert. Safe no-op until RECHAT_CLIENT_ID/SECRET are set.
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import {
  mapContact,
  mapDeal,
  mapListing,
  mapProperty,
  type RechatRaw,
} from "@/lib/integrations/rechatMap";

export interface RechatConfig {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  tokenUrl: string;
  grantType: string;
  username?: string;
  password?: string;
  webhookSecret: string;
}

export function getRechatConfig(): RechatConfig | null {
  const clientId = process.env.RECHAT_CLIENT_ID;
  const clientSecret = process.env.RECHAT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const apiBase = process.env.RECHAT_API_BASE ?? "https://api.rechat.com";
  return {
    clientId,
    clientSecret,
    apiBase,
    tokenUrl: process.env.RECHAT_TOKEN_URL ?? `${apiBase}/oauth2/token`,
    grantType: process.env.RECHAT_GRANT_TYPE ?? "client_credentials",
    username: process.env.RECHAT_USERNAME,
    password: process.env.RECHAT_PASSWORD,
    webhookSecret: process.env.RECHAT_WEBHOOK_SECRET ?? "",
  };
}

export function isRechatConfigured(): boolean {
  return Boolean(process.env.RECHAT_CLIENT_ID && process.env.RECHAT_CLIENT_SECRET);
}

// ── OAuth token (cached per serverless instance) ──────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: RechatConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: config.grantType,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  // Password grant (only if Rechat provisions it for your app).
  if (config.grantType === "password" && config.username && config.password) {
    body.set("username", config.username);
    body.set("password", config.password);
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Rechat token request failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

// ── paginated fetch ───────────────────────────────────────────
async function rechatGetAll(config: RechatConfig, path: string): Promise<RechatRaw[]> {
  const token = await getAccessToken(config);
  const out: RechatRaw[] = [];
  let start = 0;
  const limit = 50;

  // Rechat commonly paginates with ?start=&limit=; loop until a short page.
  for (let guard = 0; guard < 200; guard++) {
    const url = `${config.apiBase}${path}${path.includes("?") ? "&" : "?"}start=${start}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Rechat GET ${path} failed (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();
    const page: RechatRaw[] = Array.isArray(json) ? json : (json.data ?? []);
    out.push(...page);
    if (page.length < limit) break;
    start += limit;
  }
  return out;
}

// ── id maps (resolve Rechat FKs → local uuids) ────────────────
type Supa = NonNullable<ReturnType<typeof getSupabaseServer>>;

async function buildIdMap(supabase: Supa, table: string): Promise<Map<string, string>> {
  const { data } = await supabase.from(table).select("id, rechat_id");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.rechat_id) map.set(String(row.rechat_id), String(row.id));
  }
  return map;
}

/**
 * Pull everything from Rechat and upsert into Supabase.
 * Order matters: properties + contacts first (deals/listings reference them).
 */
export async function syncFromRechat(): Promise<{
  contacts: number;
  properties: number;
  deals: number;
  listings: number;
}> {
  const config = getRechatConfig();
  if (!config) {
    throw new Error("Rechat is not configured. Set RECHAT_CLIENT_ID and RECHAT_CLIENT_SECRET.");
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new Error("Supabase is not configured (need SUPABASE_SERVICE_ROLE_KEY to write).");
  }

  // 1. Fetch raw objects from Rechat.
  const [rawContacts, rawListings, rawDeals] = await Promise.all([
    rechatGetAll(config, "/contacts"),
    rechatGetAll(config, "/listings"),
    rechatGetAll(config, "/deals"),
  ]);

  // 2. Upsert contacts + properties (properties come off listings and deals).
  const contactRows = rawContacts.map(mapContact);
  if (contactRows.length) {
    await supabase.from("contacts").upsert(contactRows, { onConflict: "rechat_id" });
  }

  const listingMapped = rawListings.map(mapListing);
  const propertyRows = rawListings.map(mapProperty);
  if (propertyRows.length) {
    await supabase.from("properties").upsert(propertyRows, { onConflict: "rechat_id" });
  }

  // 3. Resolve FKs.
  const propMap = await buildIdMap(supabase, "properties");
  const contactMap = await buildIdMap(supabase, "contacts");

  // 4. Upsert listings (need property_id).
  const listingRows = listingMapped.map((l) => ({
    ...l.row,
    property_id: l.rechatPropertyId ? propMap.get(l.rechatPropertyId) ?? null : null,
  }));
  if (listingRows.length) {
    await supabase.from("listings").upsert(listingRows, { onConflict: "rechat_id" });
  }

  // 5. Upsert deals (need property_id + contact_id).
  const dealRows = rawDeals.map(mapDeal).map((d) => ({
    ...d.row,
    property_id: d.rechatPropertyId ? propMap.get(d.rechatPropertyId) ?? null : null,
    contact_id: d.rechatContactId ? contactMap.get(d.rechatContactId) ?? null : null,
  }));
  if (dealRows.length) {
    await supabase.from("deals").upsert(dealRows, { onConflict: "rechat_id" });
  }

  return {
    contacts: contactRows.length,
    properties: propertyRows.length,
    deals: dealRows.length,
    listings: listingRows.length,
  };
}

/** Upsert a single record from a webhook payload by resource type. */
export async function upsertRechatRecord(
  resource: string,
  raw: RechatRaw,
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Supabase not configured.");

  switch (resource) {
    case "contact":
      await supabase.from("contacts").upsert([mapContact(raw)], { onConflict: "rechat_id" });
      break;
    case "listing": {
      await supabase.from("properties").upsert([mapProperty(raw)], { onConflict: "rechat_id" });
      const propMap = await buildIdMap(supabase, "properties");
      const l = mapListing(raw);
      await supabase.from("listings").upsert(
        [{ ...l.row, property_id: l.rechatPropertyId ? propMap.get(l.rechatPropertyId) ?? null : null }],
        { onConflict: "rechat_id" },
      );
      break;
    }
    case "deal": {
      const propMap = await buildIdMap(supabase, "properties");
      const contactMap = await buildIdMap(supabase, "contacts");
      const d = mapDeal(raw);
      await supabase.from("deals").upsert(
        [{
          ...d.row,
          property_id: d.rechatPropertyId ? propMap.get(d.rechatPropertyId) ?? null : null,
          contact_id: d.rechatContactId ? contactMap.get(d.rechatContactId) ?? null : null,
        }],
        { onConflict: "rechat_id" },
      );
      break;
    }
    default:
      // Unhandled resource types are ignored (safe).
      break;
  }
}
