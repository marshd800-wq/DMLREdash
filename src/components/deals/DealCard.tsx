import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MilestoneTracker } from "@/components/deals/MilestoneTracker";
import type { Deal, Property, Task } from "@/lib/types";
import { dealHealth, daysAway } from "@/lib/data/deadline";
import { formatCompactCurrency } from "@/lib/utils";

/**
 * Pipeline deal card: milestone tracker + the anchored task checklist the
 * deadline engine generated. Overdue tasks are red; upcoming show their due date.
 */
export function DealCard({
  deal,
  property,
  tasks,
}: {
  deal: Deal;
  property: Property | undefined;
  tasks: Task[];
}) {
  const dealTasks = tasks
    .filter((t) => t.deal_id === deal.id)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const health = dealHealth(deal, tasks);

  const anchors: Array<[string, string | null]> = [
    ["Binding", deal.binding_date],
    ["DD end", deal.dd_end],
    ["Appraisal", deal.appraisal_end],
    ["Financing", deal.financing_end],
    ["Closing", deal.closing_date],
  ];

  return (
    <Card id={deal.id} className="scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg text-espresso">
              {property?.address ?? "Unknown address"}
            </h3>
            <p className="text-xs text-bronze">
              {property?.city}, {property?.state} · {deal.side === "listing" ? "Listing" : "Buyer"} side ·{" "}
              {formatCompactCurrency(deal.price)}
            </p>
          </div>
          <Badge tone={health === "red" ? "alert" : health === "amber" ? "amber" : "accent"}>
            {health === "red" ? "Needs attention" : health === "amber" ? "Deadline near" : "On track"}
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <MilestoneTracker status={deal.status} health={health} />

        {/* Anchor dates */}
        <div className="flex flex-wrap gap-2">
          {anchors.map(([label, date]) => (
            <span
              key={label}
              className="rounded-md bg-cream px-2 py-1 text-[11px] text-bronze"
            >
              <span className="font-medium text-espresso">{label}:</span>{" "}
              {date ?? "—"}
            </span>
          ))}
        </div>

        {/* Task checklist (deadline engine) */}
        <div>
          <p className="brand-eyebrow mb-2">Deadline checklist</p>
          <ul className="space-y-1.5">
            {dealTasks.map((t) => {
              const away = t.due_date ? daysAway(t.due_date) : null;
              const overdue = t.status === "overdue";
              const done = t.status === "done";
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[9px] leading-none text-white " +
                        (done
                          ? "border-terracotta bg-terracotta"
                          : overdue
                            ? "border-oxblood"
                            : "border-tan")
                      }
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span
                      className={
                        done
                          ? "text-bronze line-through"
                          : overdue
                            ? "text-oxblood"
                            : "text-espresso"
                      }
                    >
                      {t.title}
                    </span>
                  </span>
                  <span
                    className={
                      "shrink-0 text-xs " +
                      (done ? "text-bronze" : overdue ? "text-oxblood" : "text-bronze")
                    }
                  >
                    {done
                      ? "done"
                      : t.due_date
                        ? overdue
                          ? `overdue · ${t.due_date}`
                          : away === 0
                            ? "today"
                            : `in ${away}d`
                        : "date TBD"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
