import { Card } from "@/components/ui/card";
import { BandHeading } from "@/components/dashboard/BandHeading";
import { GciGauge } from "@/components/dashboard/GciGauge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { DashboardMetrics } from "@/lib/types";
import { formatCompactCurrency, formatNumber } from "@/lib/utils";

/**
 * BAND 1 — "How am I doing?" (PRD §4, Question 1).
 * GCI-vs-goal gauge + the four leading/lagging indicators.
 */
export function Band1({ metrics }: { metrics: DashboardMetrics }) {
  const { gci, appointments, listingsTaken, underContract, closingsThisMonth } =
    metrics;

  const apptDelta = appointments.thisWeek - appointments.lastWeek;
  const apptTrend = {
    direction:
      apptDelta > 0 ? "up" : apptDelta < 0 ? "down" : "flat",
    text:
      apptDelta === 0
        ? "same as last week"
        : `${apptDelta > 0 ? "+" : ""}${apptDelta} vs last week`,
  } as const;

  return (
    <section>
      <BandHeading
        question="Question 1"
        title="How am I doing?"
        note="GCI vs goal · appointments · listings · pipeline · closings"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* GCI gauge spans a full column and both rows on large screens */}
        <Card className="p-5 lg:row-span-2">
          <p className="brand-eyebrow mb-2">GCI vs. annual goal</p>
          <GciGauge
            annualGoal={gci.annualGoal}
            closedGci={gci.closedGci}
            pendingGci={gci.pendingGci}
          />
        </Card>

        <MetricCard
          label="Appointments booked · this week"
          value={formatNumber(appointments.thisWeek)}
          sub={`${formatNumber(appointments.thisMonth)} this month`}
          trend={apptTrend}
          accent
        />

        <MetricCard
          label="Listings taken · MTD"
          value={formatNumber(listingsTaken.mtd)}
          sub={`${formatNumber(listingsTaken.ytd)} YTD`}
        />

        <MetricCard
          label="Under contract"
          value={formatNumber(underContract.count)}
          sub={`${formatCompactCurrency(underContract.volume)} in pipeline`}
        />

        <MetricCard
          label="Closings this month"
          value={formatNumber(closingsThisMonth.count)}
          sub={`${formatCompactCurrency(closingsThisMonth.volume)} volume`}
        />
      </div>
    </section>
  );
}
