/**
 * ─────────────────────────────────────────────────────────────
 *  RECHAT → SUPABASE MAPPING  (the ONE file to adjust for real payloads)
 * ─────────────────────────────────────────────────────────────
 *
 * These functions translate Rechat API objects into Diana's OS Supabase rows.
 * Field names here are a BEST-EFFORT against Rechat's documented patterns and
 * MUST be verified against a real API response once credentials exist — Rechat
 * returns rich objects and the exact keys (esp. for deals/contexts) vary.
 *
 * Everything else in the sync engine (auth, fetch, dedupe-upsert, FK resolution,
 * webhooks, cron) is payload-agnostic and does NOT need to change — only this
 * file does. Each mapper uses defensive fallbacks so a missing field degrades to
 * null instead of throwing.
 */

// Rechat payloads are dynamic JSON; `any` is intentional in this mapping layer.
// eslint-disable-next-line
export type RechatRaw = Record<string, any>;

// ── helpers ──────────────────────────────────────────────────
function firstEmail(r: RechatRaw): string | null {
  if (typeof r.email === "string") return r.email;
  if (Array.isArray(r.emails) && r.emails.length) {
    const e = r.emails[0];
    return typeof e === "string" ? e : (e?.email ?? e?.value ?? null);
  }
  return null;
}

function firstPhone(r: RechatRaw): string | null {
  if (typeof r.phone_number === "string") return r.phone_number;
  if (typeof r.phone === "string") return r.phone;
  if (Array.isArray(r.phone_numbers) && r.phone_numbers.length) {
    const p = r.phone_numbers[0];
    return typeof p === "string" ? p : (p?.phone_number ?? p?.value ?? null);
  }
  return null;
}

function num(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Rechat timestamps are often unix seconds; normalize to an ISO date (YYYY-MM-DD). */
function toDate(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // seconds vs ms
    return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ── contacts ─────────────────────────────────────────────────
function mapContactType(r: RechatRaw): string {
  const t = String(r.contact_type ?? r.type ?? "").toLowerCase();
  if (t.includes("past")) return "past_client";
  if (t.includes("active") || t.includes("client")) return "active_client";
  if (t.includes("sphere")) return "sphere";
  if (t.includes("agent")) return "agent";
  if (t.includes("vendor")) return "vendor";
  return "lead";
}

export function mapContact(r: RechatRaw) {
  const attrs = r.summary ?? r; // Rechat often nests display fields under `summary`
  return {
    rechat_id: String(r.id),
    first_name: attrs.first_name ?? attrs.given_name ?? "",
    last_name: attrs.last_name ?? attrs.family_name ?? "",
    email: firstEmail(attrs) ?? firstEmail(r),
    phone: firstPhone(attrs) ?? firstPhone(r),
    type: mapContactType(r),
    source: r.source_type ?? r.source ?? attrs.source ?? null,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  };
}

// ── properties ───────────────────────────────────────────────
// Confirmed against the Listing docs: a listing carries a nested `property`,
// which carries a nested `address` (full_address, state_code, postal_code,
// location_google.coordinates = [lng, lat]). sqft comes from the formatted
// block (square_feet.value) or is derived from square_meters.
export function mapProperty(listing: RechatRaw) {
  const p = listing.property ?? {};
  const a = p.address ?? {};
  const coords: number[] = a.location_google?.coordinates ?? a.location?.coordinates ?? [];
  const sqft =
    listing.formatted?.square_feet?.value ??
    (p.square_meters ? Math.round(p.square_meters * 10.7639) : null);
  return {
    rechat_id: String(listing.property_id ?? p.id),
    address: a.full_address ?? a.street_address ?? "Unknown address",
    city: a.city ?? null,
    state: a.state_code ?? a.state ?? null,
    zip: a.postal_code ?? null,
    beds: num(p.bedroom_count),
    baths: num(p.bathroom_count),
    sqft: num(sqft),
    list_price: num(listing.price),
    lat: num(coords[1]),
    lng: num(coords[0]),
  };
}

// ── deals ────────────────────────────────────────────────────
/** Rechat deals expose values via a context bag; pull a named context date. */
function ctxDate(r: RechatRaw, key: string): string | null {
  const ctx = r.contexts ?? r.deal_context ?? {};
  const v = ctx?.[key]?.date ?? ctx?.[key]?.value ?? ctx?.[key] ?? r[key];
  return toDate(v);
}
function ctxNum(r: RechatRaw, key: string): number | null {
  const ctx = r.contexts ?? r.deal_context ?? {};
  return num(ctx?.[key]?.number ?? ctx?.[key]?.value ?? ctx?.[key] ?? r[key]);
}

function mapDealStatus(r: RechatRaw, isClosed: boolean): string {
  if (isClosed) return "sold";
  const s = String(r.status ?? r.stage ?? "").toLowerCase();
  if (s.includes("clear")) return "clear_to_close";
  if (s.includes("financ")) return "financing";
  if (s.includes("apprais")) return "appraisal";
  if (s.includes("inspect")) return "inspection";
  if (s.includes("clos")) return "closing";
  return "under_contract";
}

export function mapDeal(r: RechatRaw) {
  const isListing =
    String(r.deal_type ?? r.side ?? "").toLowerCase().includes("selling") ||
    String(r.deal_type ?? r.side ?? "").toLowerCase().includes("listing");
  const closingDate = ctxDate(r, "closing_date");
  const isClosed = Boolean(r.is_closed ?? r.closed ?? false);
  const price =
    ctxNum(r, "sales_price") ?? ctxNum(r, "list_price") ?? num(r.price) ?? 0;

  return {
    row: {
      rechat_id: String(r.id),
      side: isListing ? "listing" : "buyer",
      status: mapDealStatus(r, isClosed),
      price: price ?? 0,
      commission_rate: num(r.commission_rate) ?? 0.03,
      binding_date: ctxDate(r, "contract_date") ?? ctxDate(r, "binding_date"),
      dd_end: ctxDate(r, "inspection_period_end") ?? ctxDate(r, "due_diligence_end"),
      financing_end: ctxDate(r, "financing_contingency_date") ?? ctxDate(r, "financing_end"),
      appraisal_end: ctxDate(r, "appraisal_contingency_date") ?? ctxDate(r, "appraisal_end"),
      closing_date: closingDate,
      is_closed: isClosed,
    },
    // Rechat foreign keys — resolved to local uuids during sync.
    rechatPropertyId: r.listing ? String(r.listing) : (r.property_id ? String(r.property_id) : null),
    rechatContactId: firstDealContactId(r),
  };
}

function firstDealContactId(r: RechatRaw): string | null {
  const roles = r.roles ?? r.deal_roles ?? [];
  if (Array.isArray(roles) && roles.length) {
    const client = roles.find((x: any) =>
      String(x.role ?? "").toLowerCase().includes("buyer") ||
      String(x.role ?? "").toLowerCase().includes("seller"),
    ) ?? roles[0];
    const c = client?.contact ?? client?.contact_id ?? client?.id;
    return c ? String(c) : null;
  }
  return r.contact_id ? String(r.contact_id) : null;
}

// ── listings ─────────────────────────────────────────────────
// MLS statuses are capitalized (Active / Pending / Sold / Leased / Expired /
// Withdrawn). list_date is unix seconds. `dom` (days on market) is present in
// list responses when available.
function mapListingStatus(status: unknown): string {
  const s = String(status ?? "").toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s.includes("sold") || s.includes("closed") || s.includes("leased")) return "sold";
  if (s.includes("expired")) return "expired";
  if (s.includes("withdraw")) return "withdrawn";
  return "active";
}

export function mapListing(listing: RechatRaw) {
  return {
    row: {
      rechat_id: String(listing.id),
      list_date:
        toDate(listing.list_date ?? listing.created_at) ??
        new Date().toISOString().slice(0, 10),
      status: mapListingStatus(listing.status),
      last_price_change: null, // MLS feed has no explicit price-change date
      showings_count: 0, // showings come from ShowingTime, not the MLS listing
      feedback_summary: null,
    },
    rechatPropertyId: String(listing.property_id ?? listing.property?.id ?? ""),
  };
}
