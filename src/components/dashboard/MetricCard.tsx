import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single Band-1 headline metric ("appointments booked", "under contract"…).
 * Big Inter tabular numeral, an eyebrow label, an optional sub-line and trend.
 */
export function MetricCard({
  label,
  value,
  sub,
  trend,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  accent?: boolean;
}) {
  return (
    <Card className={cn("p-5", accent && "border-terracotta/40 bg-terracotta/[0.04]")}>
      <p className="brand-eyebrow">{label}</p>
      <p className="tabular mt-2 font-display text-4xl leading-none text-espresso">
        {value}
      </p>
      {sub && <p className="tabular mt-2 text-sm text-bronze">{sub}</p>}
      {trend && (
        <p
          className={cn(
            "tabular mt-3 inline-flex items-center gap-1 text-xs font-medium",
            trend.direction === "up" && "text-terracotta",
            trend.direction === "down" && "text-oxblood",
            trend.direction === "flat" && "text-bronze",
          )}
        >
          <TrendGlyph direction={trend.direction} />
          {trend.text}
        </p>
      )}
    </Card>
  );
}

function TrendGlyph({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <span aria-hidden>▲</span>;
  if (direction === "down") return <span aria-hidden>▼</span>;
  return <span aria-hidden>■</span>;
}
