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
