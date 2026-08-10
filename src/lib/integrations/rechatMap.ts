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
 * agnostic. The Contact shape is also confirmed: a flat object with
 * first_name/last_name, email + emails[], phone_number + phone_numbers[],
 * tags[], source_type, and unix last_touch/next_touch/touch_freq. Tags drive
 * both type (Buyer/Seller/Past Client/Agent…) and heat (Hot/Warm/New).
 * deal↔contact is linked by email.
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

/** Rechat timestamps are unix seconds; normalize to a full ISO datetime. */
function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // seconds vs ms
    return new Date(ms).toISOString();
  }
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
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

// ── contacts (confirmed against the /contacts payload) ──
// Rechat contacts are flat. Both a scalar (email/phone_number) and a plural
// array (emails[]/phone_numbers[]) may be present; the array entries are plain
// strings in the confirmed shape, but we tolerate {email}/{value} objects too.
function firstEmail(r: RechatRaw): string | null {
  if (typeof r.email === "string" && r.email) return r.email;
  if (Array.isArray(r.emails) && r.emails.length) {
    const e = r.emails[0];
    return typeof e === "string" ? e : (e?.email ?? e?.value ?? null);
  }
  return null;
}
function firstPhone(r: RechatRaw): string | null {
  if (typeof r.phone_number === "string" && r.phone_number) return r.phone_number;
  if (typeof r.phone === "string" && r.phone) return r.phone;
  if (Array.isArray(r.phone_numbers) && r.phone_numbers.length) {
    const p = r.phone_numbers[0];
    return typeof p === "string" ? p : (p?.phone_number ?? p?.value ?? null);
  }
  return null;
}

/** Lowercased tag set for a contact (Rechat tags are plain strings). */
function tagSet(r: RechatRaw): Set<string> {
  const tags = Array.isArray(r.tags) ? r.tags.map((t: unknown) => String(t).toLowerCase()) : [];
  return new Set(tags);
}

/**
 * Contact type from Rechat tags. Tags are Diana's segmentation mechanism, so
 * they win; source_type is a weak fallback. Order matters — a past client who
 * is also tagged Agent should read as an agent relationship last, so we check
 * the "relationship" tags (agent/vendor) before client stages.
 */
function mapContactType(r: RechatRaw): string {
  const tags = tagSet(r);
  const has = (...names: string[]) => names.some((n) => tags.has(n));
  if (has("agent", "realtor", "broker")) return "agent";
  if (has("vendor", "lender", "inspector", "title", "attorney", "contractor")) return "vendor";
  if (has("past client", "past-client", "client")) return "past_client";
  if (has("sphere", "sphere of influence", "friend", "family")) return "sphere";
  if (has("buyer", "seller", "active client", "under contract")) return "active_client";
  if (has("lead", "new", "prospect")) return "lead";
  return "lead";
}

/** Contact heat from Rechat tags (Hot/Warm/New/Cold/Nurture). */
function mapContactHeat(r: RechatRaw): string {
  const tags = tagSet(r);
  // No 'hot' in our heat enum; Hot collapses to the hottest we track (warm).
  if (tags.has("hot") || tags.has("warm")) return "warm";
  if (tags.has("cold")) return "cold";
  if (tags.has("nurture") || tags.has("drip")) return "nurture";
  return "new";
}

export function mapContact(r: RechatRaw) {
  // next_touch_due prefers Rechat's own next_touch; else last_touch + touch_freq.
  const lastTouchIso = toIso(r.last_touch);
  const touchFreq = num(r.touch_freq);
  let nextTouchDue = toDate(r.next_touch);
  if (!nextTouchDue && lastTouchIso && touchFreq) {
    nextTouchDue = toDate(new Date(lastTouchIso).getTime() + touchFreq * 24 * 60 * 60 * 1000);
  }

  return {
    rechat_id: String(r.id),
    first_name: r.first_name ?? r.given_name ?? "",
    last_name: r.last_name ?? r.family_name ?? "",
    email: firstEmail(r),
    phone: firstPhone(r),
    type: mapContactType(r),
    heat: mapContactHeat(r),
    source: r.source_type ?? r.source ?? null,
    last_touch_at: lastTouchIso,
    next_touch_due: nextTouchDue,
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  };
}

// ── calendar events (the unified timeline: touches, emails, CRM tasks) ──
// Rechat's /calendar feed merges many sources under one calendar_event shape,
// tagged by `object_type`. We fan the ones Diana's OS needs into two tables:
//   • activity / email_thread → `activities` (the touch log that feeds Band 2
//     cadence — "last touch 34d ago"; email_thread carries synced Gmail/Outlook)
//   • crm_task               → `appointments` (scheduled, real-world commitments)
// We deliberately skip the rest: deal_context deadlines already come from the
// deal itself (mapDeal), contact_attribute birthdays/anniversaries are computed
// by the cadence engine (and their raw `timestamp` is the ORIGINAL date — a
// wedding anniversary is stamped in the year it happened — so it must never be
// read as an event time), and email_campaign/holiday aren't actionable here.

/** Single associated contact for an event/task. Calendar events carry a scalar
 *  `contact`; raw crm_task objects carry a flat `contacts[]` id array. */
function eventContactRechatId(ev: RechatRaw): string | null {
  if (ev.contact) return String(ev.contact);
  if (Array.isArray(ev.contacts) && ev.contacts.length) return String(ev.contacts[0]);
  const people = Array.isArray(ev.people) ? ev.people : [];
  if (people.length === 1 && people[0]?.id) return String(people[0].id);
  return null;
}

/** Single associated deal (scalar `deal` on events; `deals[]` on raw tasks). */
function eventDealRechatId(ev: RechatRaw): string | null {
  if (ev.deal) return String(ev.deal);
  if (Array.isArray(ev.deals) && ev.deals.length) return String(ev.deals[0]);
  return null;
}

/** Rechat activity/email event_type → our activity_type enum. */
function mapActivityType(eventType: string, objectType: string): string {
  const t = eventType.toLowerCase();
  if (objectType === "email_thread" || t === "gmail" || t === "outlook" || t.includes("email"))
    return "email";
  if (t.includes("call")) return "call";
  if (t.includes("text") || t.includes("sms") || t.includes("message")) return "text";
  if (t.includes("meet") || t.includes("tour") || t.includes("show") || t.includes("appointment"))
    return "meeting";
  return "note";
}

/** Rechat crm_task event_type → our appointment_type enum. */
function mapAppointmentType(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("closing")) return "closing";
  if (t.includes("listing")) return "listing";
  if (t.includes("tour") || t.includes("open house") || t.includes("show") || t.includes("inspection"))
    return "showing";
  return "consult"; // Call / Message / Todo / Follow up — a scheduled interaction
}

export type CalendarMapped =
  | {
      kind: "activity";
      contactRechatId: string | null;
      row: {
        rechat_id: string;
        type: string;
        occurred_at: string;
        channel: string | null;
        notes: string | null;
      };
    }
  | {
      kind: "appointment";
      contactRechatId: string | null;
      dealRechatId: string | null;
      row: { rechat_id: string; type: string; starts_at: string; source: string; status: string };
    }
  | { kind: "skip" };

export function mapCalendarEvent(ev: RechatRaw): CalendarMapped {
  // Calendar events tag their source in `object_type`; a raw crm_task / activity
  // object (e.g. from a webhook) tags it in `type` instead. Normalize both.
  const objectType = String(ev.object_type ?? (ev.type === "crm_task" ? "crm_task" : ev.type === "activity" ? "activity" : ""));
  const eventType = String(ev.event_type ?? ev.task_type ?? "");
  const id = String(ev.id ?? "");

  if (objectType === "activity" || objectType === "email_thread") {
    const occurred = toIso(ev.timestamp ?? ev.occurred_at ?? ev.created_at);
    if (!occurred || !id) return { kind: "skip" };
    return {
      kind: "activity",
      contactRechatId: eventContactRechatId(ev),
      row: {
        rechat_id: `cal:${id}`,
        type: mapActivityType(eventType, objectType),
        occurred_at: occurred,
        channel: objectType === "email_thread" ? eventType || "email" : eventType || null,
        notes: ev.title ?? null,
      },
    };
  }

  if (objectType === "crm_task") {
    // Calendar events time the task in `timestamp`; a raw task uses `due_date`.
    const startsAt = toIso(ev.timestamp ?? ev.due_date);
    if (!startsAt || !id) return { kind: "skip" };
    return {
      kind: "appointment",
      contactRechatId: eventContactRechatId(ev),
      dealRechatId: eventDealRechatId(ev),
      row: {
        rechat_id: `cal:${id}`,
        type: mapAppointmentType(eventType),
        starts_at: startsAt,
        source: "rechat",
        status: "confirmed",
      },
    };
  }

  return { kind: "skip" };
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
