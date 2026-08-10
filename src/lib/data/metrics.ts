import type { Deal, Listing, Appointment, DashboardMetrics } from "@/lib/types";

/**
 * Computed fields + Band-1 dashboard metrics (PRD §3 "Key computed fields", §4 Band 1).
 * Pure functions over the raw records so they work identically on sample data
 * and live Rechat/Supabase data.
 */

const DAY = 24 * 60 * 60 * 1000;
export const STALE_DOM_THRESHOLD = 21; // days-on-market default (PRD §3 listings)

function daysBetween(fromISO: string, to: Date = new Date()): number {
  const from = new Date(fromISO).getTime();
  return Math.floor((to.getTime() - from) / DAY);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sun
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/** days_on_market = today − list_date. */
export function computeDaysOnMarket(listing: Listing): number {
  return Math.max(0, daysBetween(listing.list_date));
}

/** stale_flag = DOM > threshold with no accepted offer (active/expired only). */
export function computeStaleFlag(listing: Listing): boolean {
  const dom = computeDaysOnMarket(listing);
  const noOffer = listing.status === "active" || listing.status === "expired";
  return noOffer && dom > STALE_DOM_THRESHOLD;
}

/** gci = price × commission_rate. */
export function computeGci(deal: Pick<Deal, "price" | "commission_rate">): number {
  return Math.round(deal.price * deal.commission_rate);
}

export function withComputedFields(listings: Listing[]): Listing[] {
  return listings.map((l) => ({
    ...l,
    days_on_market: computeDaysOnMarket(l),
    stale_flag: computeStaleFlag(l),
  }));
}

/**
 * Roll the raw records up into the five Band-1 headline metrics.
 * `annualGoal` comes from NEXT_PUBLIC_GCI_ANNUAL_GOAL (default 750k).
 */
export function computeDashboardMetrics(
  deals: Deal[],
  listings: Listing[],
  appointments: Appointment[],
  annualGoal: number,
): DashboardMetrics {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY);
  const monthStart = startOfMonth(now);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const yearStart = startOfYear(now);

  // ── GCI: closed (YTD) vs pending (open pipeline) ──
  const closedGci = deals
    .filter((d) => d.is_closed && d.closing_date && new Date(d.closing_date) >= yearStart)
    .reduce((sum, d) => sum + (d.gci || computeGci(d)), 0);

  const pendingGci = deals
    .filter((d) => !d.is_closed)
    .reduce((sum, d) => sum + (d.gci || computeGci(d)), 0);

  // ── Appointments booked (leading indicator) ──
  const inRange = (iso: string, start: Date, end: Date) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const apptsThisWeek = appointments.filter((a) => inRange(a.starts_at, weekStart, weekEnd)).length;
  const apptsLastWeek = appointments.filter((a) => inRange(a.starts_at, lastWeekStart, weekStart)).length;
  const apptsThisMonth = appointments.filter((a) => inRange(a.starts_at, monthStart, monthEnd)).length;

  // ── Listings taken (new listings signed) ──
  const listingsMtd = listings.filter((l) => new Date(l.list_date) >= monthStart).length;
  const listingsYtd = listings.filter((l) => new Date(l.list_date) >= yearStart).length;

  // ── Under contract (open pipeline) ──
  const openDeals = deals.filter((d) => !d.is_closed);
  const underContractVolume = openDeals.reduce((sum, d) => sum + d.price, 0);

  // ── Closings scheduled this month ──
  const closingsThisMonth = deals.filter(
    (d) => d.closing_date && inRange(d.closing_date, monthStart, monthEnd),
  );
  const closingsVolume = closingsThisMonth.reduce((sum, d) => sum + d.price, 0);

  return {
    gci: { annualGoal, closedGci, pendingGci },
    appointments: {
      thisWeek: apptsThisWeek,
      thisMonth: apptsThisMonth,
      lastWeek: apptsLastWeek,
    },
    listingsTaken: { mtd: listingsMtd, ytd: listingsYtd },
    underContract: { count: openDeals.length, volume: underContractVolume },
    closingsThisMonth: { count: closingsThisMonth.length, volume: closingsVolume },
  };
}
