import type {
  Activity,
  Band2Data,
  Contact,
  ContactType,
  Deal,
  OutreachItem,
  OutreachReason,
} from "@/lib/types";

/**
 * BAND 2 — "Who do I reach out to?" (PRD §4, the money band).
 *
 * Cadence rules decide who is due; the 4 Robert Allen triggers drive referral
 * asks; recently-closed deals drive review asks. Everything is a pure function
 * over contacts + deals + the activity (touch) log, so it runs on sample and
 * live data alike. The nightly cron (PRD §10) just calls these and caches the
 * result into the Morning Brief.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Touch cadence in days, by contact type + heat. Editable defaults. */
function cadenceDays(contact: Contact): number {
  switch (contact.type) {
    case "lead":
      if (contact.heat === "cold") return 21;
      return 7; // new / warm leads: weekly
    case "active_client":
      return 14;
    case "past_client":
    case "sphere":
      return 90; // quarterly
    default:
      return contact.heat === "nurture" ? 60 : 30;
  }
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

/** Latest touch for a contact from the activity log (falls back to stored). */
export function lastTouchAt(contact: Contact, activities: Activity[]): string | null {
  const mine = activities
    .filter((a) => a.contact_id === contact.id)
    .sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
  return mine[0]?.occurred_at ?? contact.last_touch_at;
}

/** next_touch_due = last touch + cadence (or the stored override). */
export function nextTouchDue(contact: Contact, activities: Activity[]): string | null {
  if (contact.next_touch_due) return contact.next_touch_due;
  const last = lastTouchAt(contact, activities);
  if (!last) return new Date().toISOString().slice(0, 10); // never touched → due now
  return new Date(new Date(last).getTime() + cadenceDays(contact) * DAY)
    .toISOString()
    .slice(0, 10);
}

// ── script snippets (would later pull from the NOS SOPs) ──
const SCRIPTS: Record<OutreachReason, string> = {
  cold_lead:
    "Hi {first} — thinking about your home search. Want me to send a few fresh listings this week?",
  past_client_due:
    "Hi {first}! It's been a minute — how's the house treating you? Would love to catch up.",
  home_anniversary:
    "Happy home anniversary, {first}! Hard to believe it's been a year. Here's what your neighborhood's doing right now.",
  review_owed:
    "{first}, it was a joy working with you! Would you mind leaving a quick review? Here's the link — takes 60 seconds.",
  referral_owed:
    "{first}, so glad we're working together. Who's the next person you know who could use help buying or selling?",
};

const REASON_LABELS: Record<OutreachReason, string> = {
  cold_lead: "Lead going cold",
  past_client_due: "Past client due",
  home_anniversary: "1-year home anniversary",
  review_owed: "Review owed",
  referral_owed: "Referral ask owed",
};

function makeItem(
  contact: Contact,
  reason: OutreachReason,
  detail: string,
  daysOverdue: number,
): OutreachItem {
  return {
    contact,
    reason,
    reasonLabel: REASON_LABELS[reason],
    detail,
    daysOverdue,
    script: SCRIPTS[reason].replace("{first}", contact.first_name),
  };
}

const isPastClientish = (t: ContactType) => t === "past_client" || t === "sphere";

/** Most recent closed deal for a contact (for anniversary / review windows). */
function lastClosedDeal(contactId: string, deals: Deal[]): Deal | undefined {
  return deals
    .filter((d) => d.contact_id === contactId && d.is_closed && d.closing_date)
    .sort((a, b) => +new Date(b.closing_date!) - +new Date(a.closing_date!))[0];
}

export function computeBand2(
  contacts: Contact[],
  deals: Deal[],
  activities: Activity[],
): Band2Data {
  const coldLeads: OutreachItem[] = [];
  const pastClientsDue: OutreachItem[] = [];
  const reviewsOwed: OutreachItem[] = [];
  const referralsOwed: OutreachItem[] = [];

  for (const c of contacts) {
    const due = nextTouchDue(c, activities);
    const overdueBy = due ? -(daysUntil(due) ?? 0) : 0; // positive if past due
    const lastAgo = daysAgo(lastTouchAt(c, activities));

    // Leads going cold
    if (c.type === "lead" && (c.heat === "new" || c.heat === "warm") && overdueBy >= 0) {
      coldLeads.push(
        makeItem(
          c,
          "cold_lead",
          lastAgo != null ? `Last touch ${lastAgo}d ago` : "Never contacted",
          overdueBy,
        ),
      );
    }

    // Past clients / sphere due — cadence OR 1-year home anniversary
    if (isPastClientish(c.type)) {
      const closed = lastClosedDeal(c.id, deals);
      const annivIn = closed?.closing_date
        ? daysUntil(anniversary(closed.closing_date))
        : null;

      if (annivIn != null && annivIn >= 0 && annivIn <= 14) {
        pastClientsDue.push(
          makeItem(c, "home_anniversary", `Anniversary in ${annivIn}d`, 100 - annivIn),
        );
      } else if (overdueBy >= 0) {
        pastClientsDue.push(
          makeItem(
            c,
            "past_client_due",
            lastAgo != null ? `Last touch ${lastAgo}d ago` : "Overdue",
            overdueBy,
          ),
        );
      }
    }

    // Reviews I owe — closed in the last 30 days, no review asked since closing
    const closed = lastClosedDeal(c.id, deals);
    if (closed?.closing_date) {
      const sinceClose = daysAgo(closed.closing_date) ?? 999;
      const reviewAskedAfterClose =
        c.review_asked_at && new Date(c.review_asked_at) >= new Date(closed.closing_date);
      if (sinceClose >= 0 && sinceClose <= 30 && !reviewAskedAfterClose) {
        reviewsOwed.push(
          makeItem(c, "review_owed", `Closed ${sinceClose}d ago`, 30 - sinceClose),
        );
      }
    }

    // Referral asks I owe — the 4 triggers: under contract, closed, post-consult, 1-yr
    const referralTrigger = referralTriggerFor(c, deals);
    if (referralTrigger && !recentlyAskedReferral(c)) {
      referralsOwed.push(makeItem(c, "referral_owed", referralTrigger, 50));
    }
  }

  const byOverdue = (a: OutreachItem, b: OutreachItem) => b.daysOverdue - a.daysOverdue;
  coldLeads.sort(byOverdue);
  pastClientsDue.sort(byOverdue);
  reviewsOwed.sort(byOverdue);
  referralsOwed.sort(byOverdue);

  // "Call these 10 today" — blended, de-duped by contact, top 10 by urgency.
  const seen = new Set<string>();
  const callTheseTen: OutreachItem[] = [];
  for (const item of [...coldLeads, ...reviewsOwed, ...referralsOwed, ...pastClientsDue].sort(
    byOverdue,
  )) {
    if (seen.has(item.contact.id)) continue;
    seen.add(item.contact.id);
    callTheseTen.push(item);
    if (callTheseTen.length >= 10) break;
  }

  return { coldLeads, pastClientsDue, reviewsOwed, referralsOwed, callTheseTen };
}

function anniversary(closingISO: string): string {
  const d = new Date(closingISO);
  const now = new Date();
  d.setFullYear(now.getFullYear());
  if (d.getTime() < now.getTime()) d.setFullYear(now.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function recentlyAskedReferral(c: Contact): boolean {
  const asked = daysAgo(c.referral_asked_at);
  return asked != null && asked < 90; // asked within the last quarter → not owed
}

/** Which of the 4 referral triggers applies, if any. */
function referralTriggerFor(c: Contact, deals: Deal[]): string | null {
  const contactDeals = deals.filter((d) => d.contact_id === c.id);
  if (contactDeals.some((d) => !d.is_closed)) return "Under contract now";

  const closed = lastClosedDeal(c.id, deals);
  if (closed?.closing_date) {
    const sinceClose = daysAgo(closed.closing_date) ?? 999;
    if (sinceClose >= 0 && sinceClose <= 30) return "Just closed";
    const annivIn = daysUntil(anniversary(closed.closing_date));
    if (annivIn != null && annivIn >= 0 && annivIn <= 14) return "1-year anniversary";
  }
  return null;
}
