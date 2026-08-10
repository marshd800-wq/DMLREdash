/**
 * Diana's OS — domain types.
 * These mirror the Supabase schema in supabase/migrations/0001_init.sql (PRD §3).
 * `rechat_id` is the dedupe/join key against Rechat; `notion_id` links NOS records.
 */

export type ContactType =
  | "lead"
  | "active_client"
  | "past_client"
  | "sphere"
  | "agent"
  | "vendor";

export type ContactHeat = "new" | "warm" | "cold" | "nurture";

export interface Contact {
  id: string;
  rechat_id: string | null;
  notion_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  type: ContactType;
  heat: ContactHeat;
  source: string | null;
  last_touch_at: string | null; // computed from activities
  next_touch_due: string | null; // computed by cadence rules
  touch_freq?: number | null; // Diana's real touch cadence (days), from Rechat/lists
  birthday?: string | null; // YYYY-MM-DD, drives the birthday outreach trigger
  referral_source_id: string | null;
  review_asked_at: string | null;
  referral_asked_at: string | null;
  tags: string[];
}

export interface Property {
  id: string;
  rechat_id: string | null;
  notion_id: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  list_price: number | null;
  lat: number | null;
  lng: number | null;
}

export type DealSide = "listing" | "buyer";

export type DealStatus =
  | "under_contract"
  | "inspection"
  | "appraisal"
  | "financing"
  | "clear_to_close"
  | "closing"
  | "sold";

export interface Deal {
  id: string;
  rechat_id: string | null;
  property_id: string | null;
  contact_id: string | null;
  side: DealSide;
  status: DealStatus;
  price: number;
  commission_rate: number; // e.g. 0.03
  gci: number; // computed = price * commission_rate
  binding_date: string | null;
  dd_end: string | null;
  financing_end: string | null;
  appraisal_end: string | null;
  closing_date: string | null;
  is_closed: boolean;
}

export type ListingStatus =
  | "active"
  | "pending"
  | "sold"
  | "expired"
  | "withdrawn";

export interface Listing {
  id: string;
  rechat_id: string | null;
  property_id: string | null;
  list_date: string;
  days_on_market: number; // computed = today - list_date
  status: ListingStatus;
  last_price_change: string | null;
  showings_count: number | null;
  feedback_summary: string | null;
  stale_flag: boolean; // computed = DOM > threshold w/ no offer
}

export type AppointmentType =
  | "consult"
  | "listing"
  | "showing"
  | "closing";

export type AppointmentSource = "calendly" | "rechat" | "manual" | "google";

export interface Appointment {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  type: AppointmentType;
  starts_at: string;
  source: AppointmentSource;
  status: string;
}

export type TaskAnchor =
  | "contract"
  | "inspection"
  | "appraisal"
  | "financing"
  | "closing"
  | "manual";

export type TaskStatus = "open" | "done" | "overdue";
export type TaskSource = "template" | "notion" | "manual";

export interface Task {
  id: string;
  notion_id: string | null;
  rechat_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  anchor: TaskAnchor;
  offset_days: number;
  status: TaskStatus; // 'overdue' is computed at read time
  source: TaskSource;
}

/** A deadline-engine template row (PRD §5). Data, not code. */
export interface TaskTemplate {
  id: string;
  side: DealSide;
  title: string;
  anchor: TaskAnchor;
  offset_days: number;
  sort_order: number;
}

export type ActivityType = "call" | "text" | "email" | "meeting" | "note";

export interface Activity {
  id: string;
  contact_id: string;
  type: ActivityType;
  occurred_at: string;
  channel: string | null;
  notes: string | null;
}

/** The five Band-1 headline metrics ("How am I doing?"). */
export interface DashboardMetrics {
  gci: {
    annualGoal: number;
    closedGci: number;
    pendingGci: number;
  };
  appointments: {
    thisWeek: number;
    thisMonth: number;
    lastWeek: number; // for trend
  };
  listingsTaken: {
    mtd: number;
    ytd: number;
  };
  underContract: {
    count: number;
    volume: number;
  };
  closingsThisMonth: {
    count: number;
    volume: number;
  };
}

// ── Band 2 — "Who do I reach out to?" view models ──
export type OutreachReason =
  | "cold_lead"
  | "past_client_due"
  | "home_anniversary"
  | "birthday"
  | "review_owed"
  | "referral_owed";

export interface OutreachItem {
  contact: Contact;
  reason: OutreachReason;
  reasonLabel: string;
  detail: string; // e.g. "Last touch 34 days ago"
  daysOverdue: number; // for ranking; 0 if not date-driven
  script: string; // one-tap script snippet
}

export interface Band2Data {
  coldLeads: OutreachItem[];
  pastClientsDue: OutreachItem[];
  birthdays: OutreachItem[];
  reviewsOwed: OutreachItem[];
  referralsOwed: OutreachItem[];
  callTheseTen: OutreachItem[];
}

// ── Band 3 — "What needs attention?" view models ──
export interface DeadlineItem {
  deal_id: string;
  label: string; // "Due diligence ends", "Closing"…
  date: string;
  daysAway: number;
  address: string;
  side: DealSide;
}

export interface TaskWithContext extends Task {
  address: string | null;
}

export interface StaleListingItem {
  listing: Listing;
  address: string;
  daysOnMarket: number;
  listPrice: number | null;
  lastPriceChange: string | null;
}

export interface AtRiskDealItem {
  deal_id: string;
  address: string;
  status: DealStatus;
  reason: string; // "New under contract" | "Missed <milestone>"
}

export interface Band3Data {
  deadlinesThisWeek: DeadlineItem[];
  overdueTasks: TaskWithContext[];
  staleListings: StaleListingItem[];
  atRiskDeals: AtRiskDealItem[];
}
