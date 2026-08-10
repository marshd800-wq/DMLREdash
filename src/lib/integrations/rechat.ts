/**
 * ─────────────────────────────────────────────────────────────
 *  RECHAT INTEGRATION  (PRD §7 — primary CRM / source of truth)
 * ─────────────────────────────────────────────────────────────
 *
 * Auth = OAuth 2.0 **Authorization Code** flow (per Rechat docs, partner
 * integrations must use Authorization Code or Implicit; client_credentials and
 * ClientPassword are Rechat-internal only). Flow:
 *
 *   1. One-time: Diana visits /api/auth/rechat/start → redirected to the Rechat
 *      web app (app.rechat.com/oauth2/auth), logs in, picks her brand, and is
 *      redirected back to /api/auth/rechat/callback with a ?code & ?brand.
 *   2. We exchange the code for an access_token + refresh_token at the web app's
 *      /oauth2/token and store them in Supabase (rechat_auth).
 *   3. The 15-min sync uses the stored refresh_token to mint fresh access tokens
 *      headlessly, then reads /contacts, /deals, /listings from api.rechat.com.
 *
 * Field mapping lives in rechatMap.ts (the one file to finalize against a real
 * payload). Everything here is payload-agnostic. Safe no-op until configured.
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
  apiBase: string; // data endpoints — https://api.rechat.com
  authHost: string; // OAuth lives on the web app — https://app.rechat.com
  redirectUri: string;
  webhookSecret: string;
  envRefreshToken?: string; // optional bootstrap without the browser flow
}

export function getRechatConfig(): RechatConfig | null {
  const clientId = process.env.RECHAT_CLIENT_ID;
  const clientSecret = process.env.RECHAT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const apiBase = process.env.RECHAT_API_BASE ?? "https://api.rechat.com";
  const authHost = process.env.RECHAT_AUTH_HOST ?? "https://app.rechat.com";
  const appBase = process.env.APP_BASE_URL ?? "";
  return {
    clientId,
    clientSecret,
    apiBase,
    authHost,
    redirectUri:
      process.env.RECHAT_REDIRECT_URI ?? `${appBase}/api/auth/rechat/callback`,
    webhookSecret: process.env.RECHAT_WEBHOOK_SECRET ?? "",
    envRefreshToken: process.env.RECHAT_REFRESH_TOKEN,
  };
}

export function isRechatConfigured(): boolean {
  return Boolean(process.env.RECHAT_CLIENT_ID && process.env.RECHAT_CLIENT_SECRET);
}

/** Build the authorization URL the user's browser is redirected to. */
export function buildAuthorizeUrl(config: RechatConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
  });
  return `${config.authHost}/oauth2/auth?${params.toString()}`;
}

// ── token storage (Supabase, single row) ─────────────────────
interface StoredTokens {
  access_token: string | null;
  refresh_token: string | null;
  brand_id: string | null;
  expires_at: string | null;
}

async function loadTokens(): Promise<StoredTokens | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase
    .from("rechat_auth")
    .select("access_token, refresh_token, brand_id, expires_at")
    .eq("id", 1)
    .maybeSingle();
  return (data as StoredTokens) ?? null;
}

async function saveTokens(t: StoredTokens): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase
    .from("rechat_auth")
    .upsert({ id: 1, ...t, updated_at: new Date().toISOString() });
}

// ── token endpoint calls (on the web app host) ───────────────
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

async function postToken(
  config: RechatConfig,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(`${config.authHost}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Rechat token request failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Exchange an authorization code (from the callback) for tokens; persist them. */
export async function exchangeCodeForTokens(
  config: RechatConfig,
  code: string,
  brandId: string | null,
): Promise<void> {
  const tok = await postToken(config, {
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });
  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 2678400) * 1000).toISOString();
  await saveTokens({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    brand_id: brandId,
    expires_at: expiresAt,
  });
  cachedToken = { token: tok.access_token, expiresAt: Date.parse(expiresAt) };
}

// ── access token (cached per instance, refreshed as needed) ──
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: RechatConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const stored = await loadTokens();

  // A still-valid stored access token?
  if (
    stored?.access_token &&
    stored.expires_at &&
    Date.parse(stored.expires_at) > Date.now() + 60_000
  ) {
    cachedToken = { token: stored.access_token, expiresAt: Date.parse(stored.expires_at) };
    return stored.access_token;
  }

  const refresh = stored?.refresh_token ?? config.envRefreshToken;
  if (!refresh) {
    throw new Error(
      "Rechat is not connected yet. Visit /api/auth/rechat/start to authorize.",
    );
  }

  const tok = await postToken(config, {
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const expiresAt = Date.now() + (tok.expires_in ?? 2678400) * 1000;
  await saveTokens({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? refresh,
    brand_id: stored?.brand_id ?? null,
    expires_at: new Date(expiresAt).toISOString(),
  });
  cachedToken = { token: tok.access_token, expiresAt };
  return tok.access_token;
}

// ── paginated fetch (GET or POST-filter) ─────────────────────
// Note: as of 2026-01-01 Rechat deprecated `GET /deals` (→ POST /deals/filter)
// and `GET /listings/search` (→ POST /valerts). This fetcher supports both verbs.
interface FetchSpec {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
}

async function rechatFetchAll(
  config: RechatConfig,
  spec: FetchSpec,
  token: string,
  brandId: string | null,
): Promise<RechatRaw[]> {
  const out: RechatRaw[] = [];
  let start = 0;
  const limit = 50;

  for (let guard = 0; guard < 200; guard++) {
    const sep = spec.path.includes("?") ? "&" : "?";
    const url = `${config.apiBase}${spec.path}${sep}start=${start}&limit=${limit}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    // Requests are brand-scoped; pass the brand the grant was issued under.
    if (brandId) headers["X-RECHAT-BRAND"] = brandId;

    let res: Response;
    if (spec.method === "POST") {
      headers["Content-Type"] = "application/json";
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ start, limit, ...(spec.body ?? {}) }),
      });
    } else {
      res = await fetch(url, { headers });
    }

    if (!res.ok) {
      throw new Error(
        `Rechat ${spec.method} ${spec.path} failed (${res.status}): ${await res.text()}`,
      );
    }
    const json = await res.json();
    const page: RechatRaw[] = Array.isArray(json) ? json : (json.data ?? []);
    out.push(...page);
    if (page.length < limit) break;
    start += limit;
  }
  return out;
}

/** Fetch that never throws — returns [] and records the error, so one failing
 *  resource (e.g. a filter body Rechat rejects) doesn't abort the whole sync. */
async function safeFetch(
  errors: string[],
  label: string,
  fn: () => Promise<RechatRaw[]>,
): Promise<RechatRaw[]> {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
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
  errors: string[];
}> {
  const config = getRechatConfig();
  if (!config) {
    throw new Error("Rechat is not configured. Set RECHAT_CLIENT_ID and RECHAT_CLIENT_SECRET.");
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    throw new Error("Supabase is not configured (need SUPABASE_SERVICE_ROLE_KEY to write).");
  }

  const token = await getAccessToken(config);
  const brandId = (await loadTokens())?.brand_id ?? null;
  const errors: string[] = [];

  // 1. Fetch raw objects from Rechat (each isolated — one failure ≠ total fail).
  //    Deals + listings use the POST replacements for the deprecated GET routes.
  const [rawContacts, rawListings, rawDeals] = await Promise.all([
    safeFetch(errors, "contacts", () =>
      rechatFetchAll(config, { method: "GET", path: "/contacts" }, token, brandId),
    ),
    safeFetch(errors, "listings", () =>
      rechatFetchAll(config, { method: "POST", path: "/valerts", body: {} }, token, brandId),
    ),
    safeFetch(errors, "deals", () =>
      rechatFetchAll(config, { method: "POST", path: "/deals/filter", body: {} }, token, brandId),
    ),
  ]);

  // 2. Upsert contacts + properties (properties come off listings/deals).
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
    errors,
  };
}

/** Upsert a single record from a webhook payload by resource type. */
export async function upsertRechatRecord(resource: string, raw: RechatRaw): Promise<void> {
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
      break;
  }
}
