import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BandHeading } from "@/components/dashboard/BandHeading";
import type { Band3Data } from "@/lib/types";
import { formatCompactCurrency } from "@/lib/utils";

/**
 * BAND 3 — "What needs attention?" (PRD §4).
 * Deadlines this week, overdue tasks, stale listings, new/at-risk deals —
 * all fed by the deadline engine.
 */
export function Band3({ data }: { data: Band3Data }) {
  return (
    <section>
      <BandHeading
        question="Question 3"
        title="What needs attention?"
        note="deadlines · overdue · stale listings · at-risk deals"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Deadlines this week */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-espresso">
              Deadlines this week
            </h3>
            <Badge tone={data.deadlinesThisWeek.length ? "accent" : "muted"}>
              {data.deadlinesThisWeek.length}
            </Badge>
          </CardHeader>
          <CardBody>
            {data.deadlinesThisWeek.length === 0 ? (
              <p className="py-2 text-xs text-bronze">
                Nothing due in the next 14 days.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.deadlinesThisWeek.map((d, i) => (
                  <li
                    key={`${d.deal_id}:${d.label}:${i}`}
                    className="flex items-center justify-between gap-3 border-b border-tan/40 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-espresso">
                        {d.label}
                      </p>
                      <p className="truncate text-xs text-bronze">{d.address}</p>
                    </div>
                    <DueChip daysAway={d.daysAway} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Overdue tasks */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-espresso">Overdue tasks</h3>
            <Badge tone={data.overdueTasks.length ? "alert" : "muted"}>
              {data.overdueTasks.length}
            </Badge>
          </CardHeader>
          <CardBody>
            {data.overdueTasks.length === 0 ? (
              <p className="py-2 text-xs text-bronze">Nothing overdue. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {data.overdueTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 border-b border-tan/40 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-oxblood">
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-bronze">{t.address}</p>
                    </div>
                    <span className="shrink-0 text-xs text-oxblood">
                      due {t.due_date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Stale listings */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-espresso">
              Stale listings
            </h3>
            <Badge tone={data.staleListings.length ? "amber" : "muted"}>
              {data.staleListings.length}
            </Badge>
          </CardHeader>
          <CardBody>
            {data.staleListings.length === 0 ? (
              <p className="py-2 text-xs text-bronze">
                No listings past the days-on-market threshold.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.staleListings.map((s) => (
                  <li
                    key={s.listing.id}
                    className="flex items-center justify-between gap-3 border-b border-tan/40 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-espresso">
                        {s.address}
                      </p>
                      <p className="text-xs text-bronze">
                        {s.listPrice ? formatCompactCurrency(s.listPrice) : "—"} ·
                        price-drop signal
                      </p>
                    </div>
                    <Badge tone="amber">{s.daysOnMarket} DOM</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* New / at-risk deals */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-espresso">
              New / at-risk deals
            </h3>
            <Badge tone={data.atRiskDeals.length ? "accent" : "muted"}>
              {data.atRiskDeals.length}
            </Badge>
          </CardHeader>
          <CardBody>
            {data.atRiskDeals.length === 0 ? (
              <p className="py-2 text-xs text-bronze">
                No new or at-risk deals.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.atRiskDeals.map((d, i) => (
                  <li
                    key={`${d.deal_id}:${i}`}
                    className="flex items-center justify-between gap-3 border-b border-tan/40 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/deals#${d.deal_id}`}
                        className="truncate text-sm font-medium text-espresso hover:text-terracotta"
                      >
                        {d.address}
                      </Link>
                      <p className="text-xs text-bronze">{d.reason}</p>
                    </div>
                    <Badge tone={d.reason.startsWith("Past") ? "alert" : "accent"}>
                      {d.reason.startsWith("Past") ? "at risk" : "new"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="mt-3 text-right text-xs text-bronze">
        <Link href="/deals" className="font-medium text-terracotta hover:underline">
          Open pipeline &amp; deadline tracker →
        </Link>
      </p>
    </section>
  );
}

function DueChip({ daysAway }: { daysAway: number }) {
  const tone = daysAway <= 2 ? "alert" : daysAway <= 5 ? "amber" : "neutral";
  const label =
    daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `in ${daysAway}d`;
  return <Badge tone={tone}>{label}</Badge>;
}
