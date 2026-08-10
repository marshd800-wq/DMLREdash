import { Card } from "@/components/ui/card";
import { BandHeading } from "@/components/dashboard/BandHeading";

/**
 * Preview of Bands 2 & 3 (PRD §4). These ship in Phase 2 (the deadline engine,
 * cold-lead cadence, reviews/referrals owed). Shown here as labeled outlines so
 * the one-screen structure is visible from day one without faking data.
 */

const BAND2_PANELS = [
  "Leads going cold",
  "Past clients due for a touch",
  "Reviews I owe",
  "Referral asks I owe",
  "Call these 10 today",
];

const BAND3_PANELS = [
  "Deadlines this week",
  "Overdue tasks",
  "Stale listings",
  "New / at-risk deals",
];

export function UpcomingBands() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <BandHeading question="Question 2" title="Who do I reach out to?" />
        <PreviewGrid panels={BAND2_PANELS} phase="Phase 2" />
      </section>

      <section>
        <BandHeading question="Question 3" title="What needs attention?" />
        <PreviewGrid panels={BAND3_PANELS} phase="Phase 2" />
      </section>
    </div>
  );
}

function PreviewGrid({ panels, phase }: { panels: string[]; phase: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {panels.map((p) => (
        <Card
          key={p}
          className="border-dashed bg-cream/40 p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-espresso">{p}</p>
            <span className="rounded-full border border-tan/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-bronze">
              {phase}
            </span>
          </div>
          <p className="mt-1 text-xs text-bronze">
            Wired to the deadline engine &amp; cadence rules.
          </p>
        </Card>
      ))}
    </div>
  );
}
