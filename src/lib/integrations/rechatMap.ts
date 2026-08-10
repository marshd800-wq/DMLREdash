/**
 * ─────────────────────────────────────────────────────────────
 *  RECHAT → SUPABASE MAPPING  (finalized against the real API docs)
 * ─────────────────────────────────────────────────────────────
 *
 * Translates Rechat API objects into Diana's OS Supabase rows. The Deal shape
 * is confirmed: a deal stores its data in `deal.context` — a key → {text, number,
 * date} bag. MLS-sourced values (address, list_price, listing_status, list_date)
 * are standard keys; contract/closing/financing/appraisal dates are BRAND-
 * CONFIGURABLE context keys, so we read them with fallback key names.
 *
 * Everything else (auth, fetch, dedupe-upsert, webhooks, cron) is payload-
 * agnostic. Contact field names remain best-effort until the /contacts payload
 * is confirmed; deal↔contact is linked by email.
 */

// Rechat payloads are dynamic JSON; `any` is intentional in this mapping layer.
// eslint-disable-next-line
export type RechatRaw = Record<string, any>;

// ── primitives ───────────────────────────────────────────────
function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/** Rechat dates are unix seconds; normalize to an ISO date (YYYY-MM-DD). */
function toDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // seconds vs ms
    return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const today = () => new Date().toISOString().slice(0, 10);

// ── deal_context accessors ───────────────────────────────────
function ctxText(deal: RechatRaw, key: string): string | null {
  const v = deal.context?.[key] ?? deal.deal_context?.[key];
  return v && typeof v.text === "string" && v.text !== "" ? v.text : null;
}
function ctxNum(deal: RechatRaw, key: string): number | null {
  const v = deal.context?.[key] ?? deal.deal_context?.[key];
  return v && typeof v.number === "number" ? v.number : null;
}
function ctxDate(deal: RechatRaw, key: string): string | null {
  const v = deal.context?.[key] ?? deal.deal_context?.[key];
  return v?.date != null ? toDate(v.date) : null;
}
function firstCtxDate(deal: RechatRaw, keys: string[]): string | null {
  for (const k of keys) {
    const d = ctxDate(deal, k);
    if (d) return d;
  }
  return null;
}

// Brand-configurable date context keys — fallback name lists (NTREIS-ish + generic).
const CONTRACT_KEYS = ["contract_date", "executed_date", "binding_date", "contract_executed_date"];
const DD_KEYS = ["option_period_end_date", "option_ends", "inspection_object_date", "due_diligence_end", "option_period"];
const FINANCING_KEYS = ["financing_contingency_date", "third_party_financing_date", "financing_date", "loan_approval_date"];
const APPRAISAL_KEYS = ["appraisal_contingency_date", "appraisal_date", "appraisal_object_date"];
const CLOSING_KEYS = ["closing_date", "close_date", "closing"];

// ── contacts (best-effort until /contacts payload is confirmed) ──
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
  const attrs = r.summary ?? r;
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

// ── deal helpers ─────────────────────────────────────────────
const CLIENT_ROLES = ["buyer", "seller", "tenant", "landlord"];

function clientRole(deal: RechatRaw): RechatRaw | null {
  const roles = Array.isArray(deal.roles) ? deal.roles : [];
  return roles.find((r: RechatRaw) => CLIENT_ROLES.includes(String(r.role ?? "").toLowerCase())) ?? null;
}

/** Diana's side commission as a rate (0.03). Selling deal → SellerAgent role. */
function agentCommissionRate(deal: RechatRaw, isListing: boolean): number | null {
  const roles = Array.isArray(deal.roles) ? deal.roles : [];
  const want = isListing ? "selleragent" : "buyeragent";
  const role = roles.find((r: RechatRaw) => String(r.role ?? "").toLowerCase() === want);
  const pct = role?.commission_percentage;
  return typeof pct === "number" && pct > 0 ? pct / 100 : null;
}

/** Property/listing key — the deal's listing id when set, else a per-deal id. */
const propRechatId = (deal: RechatRaw): string => String(deal.listing ?? `deal:${deal.id}`);

function isListingSide(deal: RechatRaw): boolean {
  return String(deal.deal_type ?? "").toLowerCase().startsWith("sell");
}

function mapListingStatus(status: unknown): string {
  const s = String(status ?? "").toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s.includes("sold") || s.includes("closed") || s.includes("leased")) return "sold";
  if (s.includes("expired")) return "expired";
  if (s.includes("withdraw")) return "withdrawn";
  return "active";
}

// ── property (built from the deal's context) ─────────────────
export function mapDealProperty(deal: RechatRaw) {
  return {
    rechat_id: propRechatId(deal),
    address: ctxText(deal, "full_address") ?? ctxText(deal, "street_address") ?? deal.title ?? "Unknown address",
    city: ctxText(deal, "city"),
    state: ctxText(deal, "state_code") ?? ctxText(deal, "state"),
    zip: ctxText(deal, "postal_code"),
    beds: ctxNum(deal, "bedroom_count"),
    baths: ctxNum(deal, "bathroom_count"),
    sqft: ctxNum(deal, "square_feet"),
    list_price: ctxNum(deal, "list_price"),
    lat: null,
    lng: null,
  };
}

// ── listing (for listing-side deals; drives "listings taken"/stale) ──
export function mapDealListing(deal: RechatRaw) {
  return {
    row: {
      rechat_id: `listing:${propRechatId(deal)}`,
      list_date: ctxDate(deal, "list_date") ?? today(),
      status: mapListingStatus(ctxText(deal, "listing_status")),
      last_price_change: null,
      showings_count: 0,
      feedback_summary: null,
    },
    propertyRechatId: propRechatId(deal),
  };
}

// ── deal ─────────────────────────────────────────────────────
export function mapDeal(deal: RechatRaw) {
  const isListing = isListingSide(deal);
  const status = String(ctxText(deal, "listing_status") ?? "").toLowerCase();
  const isClosed = ["sold", "closed", "leased"].some((s) => status.includes(s));
  const price = ctxNum(deal, "sales_price") ?? ctxNum(deal, "list_price") ?? 0;
  const client = clientRole(deal);

  return {
    row: {
      rechat_id: String(deal.id),
      side: isListing ? "listing" : "buyer",
      status: isClosed ? "sold" : "under_contract",
      price: price ?? 0,
      commission_rate: agentCommissionRate(deal, isListing) ?? 0.03,
      binding_date: firstCtxDate(deal, CONTRACT_KEYS),
      dd_end: firstCtxDate(deal, DD_KEYS),
      financing_end: firstCtxDate(deal, FINANCING_KEYS),
      appraisal_end: firstCtxDate(deal, APPRAISAL_KEYS),
      closing_date: firstCtxDate(deal, CLOSING_KEYS),
      is_closed: isClosed,
    },
    propertyRechatId: propRechatId(deal),
    isListing,
    clientEmail: client?.email ?? null,
  };
}
