import type { Appointment, Deal, Listing, Property, Contact } from "@/lib/types";
import {
  sampleAppointments,
  sampleContacts,
  sampleDeals,
  sampleListings,
  sampleProperties,
} from "@/lib/data/sample";
import {
  computeDashboardMetrics,
  withComputedFields,
} from "@/lib/data/metrics";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Single data-access seam for the OS.
 *
 * Phase 1 contract: read from Supabase when it is configured, otherwise return
 * the editable sample set. Either way callers get the same shapes, and computed
 * fields (DOM, stale_flag, GCI, dashboard rollups) are applied here so pages
 * stay dumb. When Rechat sync lands, it writes into these same Supabase tables
 * and nothing downstream changes.
 */

export interface DashboardData {
  metrics: ReturnType<typeof computeDashboardMetrics>;
  deals: Deal[];
  listings: Listing[];
  appointments: Appointment[];
  properties: Property[];
  contacts: Contact[];
  source: "supabase" | "sample";
  annualGoal: number;
}

function getAnnualGoal(): number {
  const raw = process.env.NEXT_PUBLIC_GCI_ANNUAL_GOAL;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 750000;
}

async function loadRaw(): Promise<{
  deals: Deal[];
  listings: Listing[];
  appointments: Appointment[];
  properties: Property[];
  contacts: Contact[];
  source: "supabase" | "sample";
}> {
  const supabase = getSupabaseServer();

  if (supabase) {
    try {
      const [deals, listings, appointments, properties, contacts] =
        await Promise.all([
          supabase.from("deals").select("*"),
          supabase.from("listings").select("*"),
          supabase.from("appointments").select("*"),
          supabase.from("properties").select("*"),
          supabase.from("contacts").select("*"),
        ]);

      // Any error (e.g. tables not migrated yet) → graceful fallback.
      const anyError =
        deals.error || listings.error || appointments.error ||
        properties.error || contacts.error;

      if (!anyError) {
        return {
          deals: (deals.data ?? []) as Deal[],
          listings: (listings.data ?? []) as Listing[],
          appointments: (appointments.data ?? []) as Appointment[],
          properties: (properties.data ?? []) as Property[],
          contacts: (contacts.data ?? []) as Contact[],
          source: "supabase",
        };
      }
    } catch {
      // network / config hiccup — fall through to sample data
    }
  }

  return {
    deals: sampleDeals,
    listings: sampleListings,
    appointments: sampleAppointments,
    properties: sampleProperties,
    contacts: sampleContacts,
    source: "sample",
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const raw = await loadRaw();
  const annualGoal = getAnnualGoal();

  // Apply computed fields (DOM, stale_flag).
  const listings = withComputedFields(raw.listings);

  const metrics = computeDashboardMetrics(
    raw.deals,
    listings,
    raw.appointments,
    annualGoal,
  );

  return {
    metrics,
    deals: raw.deals,
    listings,
    appointments: raw.appointments,
    properties: raw.properties,
    contacts: raw.contacts,
    source: raw.source,
    annualGoal,
  };
}

/** Look up a property record by id (for enriching deal/listing cards). */
export function propertyById(
  properties: Property[],
  id: string | null,
): Property | undefined {
  if (!id) return undefined;
  return properties.find((p) => p.id === id);
}
