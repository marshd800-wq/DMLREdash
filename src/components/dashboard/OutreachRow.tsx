import { Badge } from "@/components/ui/badge";
import type { OutreachItem, OutreachReason } from "@/lib/types";

const TONE_BY_REASON: Record<
  OutreachReason,
  "accent" | "alert" | "amber" | "neutral"
> = {
  cold_lead: "alert",
  past_client_due: "amber",
  home_anniversary: "accent",
  review_owed: "accent",
  referral_owed: "amber",
};

/**
 * One person to reach out to, with one-tap call/text (PRD §4 Band 2, §9 Phase 3).
 * `tel:` / `sms:` links work on mobile immediately; the script snippet is
 * copy-ready. Shows the "why now" reason + detail.
 */
export function OutreachRow({
  item,
  showReason = true,
}: {
  item: OutreachItem;
  showReason?: boolean;
}) {
  const { contact, reason, reasonLabel, detail, script } = item;
  const name = `${contact.first_name} ${contact.last_name}`;

  return (
    <li className="flex flex-col gap-2 border-b border-tan/40 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-espresso">{name}</p>
          {showReason && (
            <Badge tone={TONE_BY_REASON[reason]}>{reasonLabel}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-bronze">{detail}</p>
        <p
          className="mt-1 line-clamp-1 text-xs italic text-bronze/80"
          title={script}
        >
          &ldquo;{script}&rdquo;
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {contact.phone && (
          <>
            <a
              href={`tel:${contact.phone}`}
              className="rounded-md border border-terracotta/40 bg-terracotta px-2.5 py-1 text-xs font-medium text-white hover:bg-bronze"
            >
              Call
            </a>
            <a
              href={`sms:${contact.phone}`}
              className="rounded-md border border-tan/60 px-2.5 py-1 text-xs font-medium text-espresso hover:bg-cream"
            >
              Text
            </a>
          </>
        )}
      </div>
    </li>
  );
}
