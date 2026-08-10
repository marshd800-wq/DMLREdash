import type {
  AtRiskDealItem,
  Band3Data,
  DeadlineItem,
  Deal,
  Listing,
  Property,
  StaleListingItem,
  Task,
  TaskWithContext,
} from "@/lib/types";
import { daysAway, withTaskStatus, milestoneIndex } from "@/lib/data/deadline";
import { computeDaysOnMarket, computeStaleFlag } from "@/lib/data/metrics";

/**
 * BAND 3 — "What needs attention?" (PRD §4).
 * Deadlines in the next 7–14 days, overdue tasks, stale listings, and
 * new/at-risk deals — all derived from the deadline engine + listings.
 */

const DEADLINE_HORIZON_DAYS = 14;
const NEW_DEAL_WINDOW_DAYS = 5;

function addressFor(propId: string | null, properties: Property[]): string {
  const p = properties.find((x) => x.id === propId);
  return p?.address ?? "Unknown address";
}

export function computeBand3(
  deals: Deal[],
  listings: Listing[],
  tasks: Task[],
  properties: Property[],
): Band3Data {
  // ── Deadlines this week (next 0–14 days) across all open deals ──
  const deadlinesThisWeek: DeadlineItem[] = [];
  for (const d of deals) {
    if (d.is_closed) continue;
    const address = addressFor(d.property_id, properties);
    const candidates: Array<[string, string | null]> = [
      ["Due diligence ends", d.dd_end],
      ["Appraisal deadline", d.appraisal_end],
      ["Financing deadline", d.financing_end],
      ["Closing", d.closing_date],
    ];
    for (const [label, date] of candidates) {
      if (!date) continue;
      const away = daysAway(date);
      if (away >= 0 && away <= DEADLINE_HORIZON_DAYS) {
        deadlinesThisWeek.push({
          deal_id: d.id,
          label,
          date,
          daysAway: away,
          address,
          side: d.side,
        });
      }
    }
  }
  deadlinesThisWeek.sort((a, b) => a.daysAway - b.daysAway);

  // ── Overdue tasks ──
  const statused = withTaskStatus(tasks);
  const overdueTasks: TaskWithContext[] = statused
    .filter((t) => t.status === "overdue")
    .map((t) => {
      const deal = deals.find((d) => d.id === t.deal_id);
      return { ...t, address: deal ? addressFor(deal.property_id, properties) : null };
    })
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  // ── Stale listings (DOM > threshold, no offer) ──
  const staleListings: StaleListingItem[] = listings
    .filter((l) => computeStaleFlag(l))
    .map((l) => {
      const prop = properties.find((p) => p.id === l.property_id);
      return {
        listing: l,
        address: prop?.address ?? "Unknown address",
        daysOnMarket: computeDaysOnMarket(l),
        listPrice: prop?.list_price ?? null,
        lastPriceChange: l.last_price_change,
      };
    })
    .sort((a, b) => b.daysOnMarket - a.daysOnMarket);

  // ── New / at-risk deals ──
  const atRiskDeals: AtRiskDealItem[] = [];
  for (const d of deals) {
    if (d.is_closed) continue;
    const address = addressFor(d.property_id, properties);

    // New under contract in the last N days
    if (d.binding_date && daysAway(d.binding_date) >= -NEW_DEAL_WINDOW_DAYS && daysAway(d.binding_date) <= 0) {
      atRiskDeals.push({ deal_id: d.id, address, status: d.status, reason: "New under contract" });
      continue;
    }

    // Missed milestone: a key date passed but the deal's status hasn't advanced past it.
    const missed = missedMilestone(d);
    if (missed) {
      atRiskDeals.push({ deal_id: d.id, address, status: d.status, reason: `Past ${missed}` });
    }
  }

  return { deadlinesThisWeek, overdueTasks, staleListings, atRiskDeals };
}

/** A key date is in the past but the deal status hasn't advanced beyond it. */
function missedMilestone(d: Deal): string | null {
  const idx = milestoneIndex(d.status);
  // status index: under_contract0 inspection1 appraisal2 financing3 ctc4 closing5 sold6
  if (d.dd_end && daysAway(d.dd_end) < 0 && idx < 1) return "due-diligence date";
  if (d.appraisal_end && daysAway(d.appraisal_end) < 0 && idx < 2) return "appraisal date";
  if (d.financing_end && daysAway(d.financing_end) < 0 && idx < 3) return "financing date";
  if (d.closing_date && daysAway(d.closing_date) < 0 && idx < 6) return "closing date";
  return null;
}
