import type {
  Deal,
  DealStatus,
  Task,
  TaskAnchor,
  TaskStatus,
  TaskTemplate,
} from "@/lib/types";

/**
 * THE DEADLINE ENGINE (PRD §5 — the heart of the OS).
 *
 * When a deal goes Under Contract, generate a task set from the side-keyed
 * template. Every task is anchored to one of the deal's key dates with an
 * `offset_days`, so moving any anchor date cascades every downstream task:
 *
 *     due_date = anchor_date + offset_days
 *
 * These are pure functions over records, so they behave identically on sample
 * data and live Supabase/Rechat data.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Map a template anchor to the deal's corresponding key date. */
export function anchorDate(deal: Deal, anchor: TaskAnchor): string | null {
  switch (anchor) {
    case "contract":
      return deal.binding_date;
    case "inspection":
      return deal.dd_end; // due-diligence end
    case "appraisal":
      return deal.appraisal_end;
    case "financing":
      return deal.financing_end;
    case "closing":
      return deal.closing_date;
    case "manual":
    default:
      return null;
  }
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY)
    .toISOString()
    .slice(0, 10);
}

/** The milestone stage an anchor belongs to (index into MILESTONE_ORDER). */
function anchorStageIndex(anchor: TaskAnchor): number {
  switch (anchor) {
    case "contract":
      return 0; // under_contract
    case "inspection":
      return 1;
    case "appraisal":
      return 2;
    case "financing":
      return 3;
    case "closing":
      return 5;
    default:
      return -1; // manual — never auto-completed
  }
}

function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Days from today to a date (negative = past). */
export function daysAway(dateISO: string): number {
  const target = new Date(dateISO);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - todayStart()) / DAY);
}

/**
 * Generate the task list for a deal from the matching side templates.
 * Tasks whose anchor date is not yet set on the deal are still created but with
 * a null due_date (they light up the moment that date is entered).
 */
export function generateTasksForDeal(
  deal: Deal,
  templates: TaskTemplate[],
): Task[] {
  const dealStage = milestoneIndex(deal.status);
  return templates
    .filter((t) => t.side === deal.side)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => {
      const anchor = anchorDate(deal, t.anchor);
      const due = anchor ? addDays(anchor, t.offset_days) : null;
      // When a freshly-generated deal has already advanced past a task's stage,
      // presume that task handled (you don't have an open "confirm earnest money"
      // on a clear-to-close deal). Persisted/tracked tasks keep their real state.
      const stage = anchorStageIndex(t.anchor);
      const presumeDone = stage >= 0 && dealStage > stage;
      return {
        id: `${deal.id}:${t.id}`,
        notion_id: null,
        rechat_id: null,
        deal_id: deal.id,
        title: t.title,
        description: null,
        due_date: due,
        anchor: t.anchor,
        offset_days: t.offset_days,
        status: (presumeDone ? "done" : "open") as TaskStatus,
        source: "template" as const,
      };
    });
}

/**
 * THE CASCADE. Recompute every template task's due_date from the (possibly
 * changed) deal anchor dates. Preserves each task's done/open state; only
 * dates move. Call this whenever a deal's binding/dd/financing/appraisal/
 * closing date is edited.
 */
export function cascadeTaskDates(deal: Deal, tasks: Task[]): Task[] {
  return tasks.map((task) => {
    if (task.source !== "template" || task.anchor === "manual") return task;
    const anchor = anchorDate(deal, task.anchor);
    const due = anchor ? addDays(anchor, task.offset_days) : null;
    return { ...task, due_date: due };
  });
}

/** Overdue = has a due date in the past and not marked done. */
export function computeTaskStatus(task: Task): TaskStatus {
  if (task.status === "done") return "done";
  if (task.due_date && daysAway(task.due_date) < 0) return "overdue";
  return "open";
}

export function withTaskStatus(tasks: Task[]): Task[] {
  return tasks.map((t) => ({ ...t, status: computeTaskStatus(t) }));
}

// ── Milestone tracker (PRD §6) ──
export const MILESTONE_ORDER: DealStatus[] = [
  "under_contract",
  "inspection",
  "appraisal",
  "financing",
  "clear_to_close",
  "closing",
  "sold",
];

export const MILESTONE_LABELS: Record<DealStatus, string> = {
  under_contract: "Under Contract",
  inspection: "Inspection",
  appraisal: "Appraisal",
  financing: "Financing",
  clear_to_close: "Clear to Close",
  closing: "Closing",
  sold: "Sold",
};

/** Index of the deal's current milestone in the canonical order. */
export function milestoneIndex(status: DealStatus): number {
  return Math.max(0, MILESTONE_ORDER.indexOf(status));
}

/**
 * Health of a deal by its nearest deadline + overdue tasks:
 *   red   = an overdue task, or a key date already passed while still open
 *   amber = a key deadline within 3 days
 *   green = otherwise
 */
export function dealHealth(
  deal: Deal,
  tasks: Task[],
): "green" | "amber" | "red" {
  if (deal.is_closed) return "green";
  const statused = withTaskStatus(tasks.filter((t) => t.deal_id === deal.id));
  if (statused.some((t) => t.status === "overdue")) return "red";

  const keyDates = [deal.dd_end, deal.financing_end, deal.appraisal_end, deal.closing_date]
    .filter((d): d is string => Boolean(d))
    .map((d) => daysAway(d))
    .filter((n) => n >= 0);

  if (keyDates.some((n) => n <= 3)) return "amber";
  return "green";
}
