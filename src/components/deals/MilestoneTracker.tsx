import type { DealStatus } from "@/lib/types";
import { MILESTONE_ORDER, MILESTONE_LABELS, milestoneIndex } from "@/lib/data/deadline";
import { cn } from "@/lib/utils";

/**
 * Per-deal milestone tracker (PRD §6): Under Contract → … → Sold, with a
 * health dot. The "pizza tracker" client-facing view (Phase 3) reuses this.
 */
export function MilestoneTracker({
  status,
  health,
}: {
  status: DealStatus;
  health: "green" | "amber" | "red";
}) {
  const current = milestoneIndex(status);

  const dot =
    health === "red"
      ? "bg-oxblood"
      : health === "amber"
        ? "bg-bronze"
        : "bg-terracotta";

  return (
    <div>
      <ol className="flex items-center">
        {MILESTONE_ORDER.map((m, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <li key={m} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                    done && "bg-terracotta text-white",
                    isCurrent && `${dot} text-white ring-2 ring-offset-2 ring-terracotta/30`,
                    !done && !isCurrent && "border border-tan/60 bg-white text-bronze",
                  )}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "mt-1 hidden w-16 text-center text-[10px] leading-tight sm:block",
                    isCurrent ? "font-semibold text-espresso" : "text-bronze",
                  )}
                >
                  {MILESTONE_LABELS[m]}
                </span>
              </div>
              {i < MILESTONE_ORDER.length - 1 && (
                <span
                  className={cn(
                    "mx-1 h-0.5 flex-1",
                    i < current ? "bg-terracotta" : "bg-tan/50",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
