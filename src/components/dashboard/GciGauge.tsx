"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/utils";

/**
 * GCI vs. annual goal radial gauge (PRD §4 Band 1).
 * Closed GCI drives the filled arc; pending GCI is shown as the "on pace toward"
 * secondary figure. Terracotta accent on cream, tabular numerals.
 */
export function GciGauge({
  annualGoal,
  closedGci,
  pendingGci,
}: {
  annualGoal: number;
  closedGci: number;
  pendingGci: number;
}) {
  const pct = annualGoal > 0 ? Math.min(closedGci / annualGoal, 1) : 0;
  const projectedPct =
    annualGoal > 0 ? Math.min((closedGci + pendingGci) / annualGoal, 1) : 0;

  const data = [{ name: "gci", value: pct * 100, fill: "#A8562E" }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <RadialBarChart
          width={220}
          height={220}
          cx={110}
          cy={110}
          innerRadius={82}
          outerRadius={104}
          barSize={22}
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: "#EDE3D5" }}
            dataKey="value"
            cornerRadius={12}
            angleAxisId={0}
          />
        </RadialBarChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="brand-eyebrow">YTD GCI</span>
          <span className="tabular font-display text-3xl text-espresso">
            {formatCompactCurrency(closedGci)}
          </span>
          <span className="tabular text-sm font-medium text-terracotta">
            {formatPercent(pct)} of goal
          </span>
        </div>
      </div>

      <dl className="mt-2 grid w-full grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-cream/70 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-bronze">
            Annual goal
          </dt>
          <dd className="tabular text-sm font-semibold text-espresso">
            {formatCurrency(annualGoal)}
          </dd>
        </div>
        <div className="rounded-lg bg-cream/70 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-bronze">
            + Pending pipeline
          </dt>
          <dd className="tabular text-sm font-semibold text-espresso">
            {formatCurrency(pendingGci)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-center text-xs text-bronze">
        On pace to{" "}
        <span className="font-semibold text-terracotta">
          {formatPercent(projectedPct)}
        </span>{" "}
        of goal with pipeline included.
      </p>
    </div>
  );
}
