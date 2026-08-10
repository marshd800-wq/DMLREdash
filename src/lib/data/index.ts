import type {
  Activity,
  Appointment,
  Band2Data,
  Band3Data,
  Contact,
  Deal,
  Listing,
  Property,
  Task,
  TaskTemplate,
} from "@/lib/types";
import {
  sampleActivities,
  sampleAppointments,
  sampleContacts,
  sampleDeals,
  sampleListings,
  sampleProperties,
} from "@/lib/data/sample";
import { TASK_TEMPLATES } from "@/lib/data/templates";
import {
  computeDashboardMetrics,
  withComputedFields,
} from "@/lib/data/metrics";
import {
  generateTasksForDeal,
  withTaskStatus,
} from "@/lib/data/deadline";
import { computeBand2 } from "@/lib/data/cadence";
import { computeBand3 } from "@/lib/data/attention";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Single data-access seam for the OS.
 *
 * Reads from Supabase when configured, otherwise the editable sample set. Either
 * way callers get identical shapes with all computed fields applied here:
 * DOM/stale-flag, GCI, dashboard rollups, the deadline-engine task set + status,
 * and the Band 2/3 view models. Pages stay dumb.
 */

export interface DashboardData {
  metrics: ReturnType<typeof computeDashboardMetrics>;
  band2: Band2Data;
  band3: Band3Data;
  deals: Deal[];
  listings: Listing[];
  appointments: Appointment[];
  properties: Property[];
  contacts: Contact[];
  tasks: Task[];
  activities: Activity[];
  templates: TaskTemplate[];
  source: "supabase" | "sample";
  annualGoal: number;
}

function getAnnualGoal(): number {
  const raw = process.env.NEXT_PUBLIC_GCI_ANNUAL_GOAL;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 750000;
}

interface RawData {
  deals: Deal[];
  listings: Listing[];
  appointments: Appointment[];
  properties: Property[];
  contacts: Contact[];
  activities: Activity[];
  tasks: Task[];
  templates: TaskTemplate[];
  source: "supabase" | "sample";
}

async function loadRaw(): Promise<RawData> {
  const supabase = getSupabaseServer();

  if (supabase) {
    try {
      const [deals, listings, appointments, properties, contacts, activities, tasks, templates] =
        await Promise.all([
          supabase.from("deals").select("*"),
          supabase.from("listings").select("*"),
          supabase.from("appointments").select("*"),
          supabase.from("properties").select("*"),
          supabase.from("contacts").select("*"),
          supabase.from("activities").select("*"),
          supabase.from("tasks").select("*"),
          supabase.from("task_templates").select("*"),
        ]);

      const anyError =
        deals.error || listings.error || appointments.error ||
        properties.error || contacts.error || activities.error ||
        tasks.error || templates.error;

      if (!anyError) {
        const tmpl = (templates.data ?? []) as TaskTemplate[];
        return {
          deals: (deals.data ?? []) as Deal[],
          listings: (listings.data ?? []) as Listing[],
          appointments: (appointments.data ?? []) as Appointment[],
          properties: (properties.data ?? []) as Property[],
          contacts: (contacts.data ?? []) as Contact[],
          activities: (activities.data ?? []) as Activity[],
          tasks: (tasks.data ?? []) as Task[],
          templates: tmpl.length ? tmpl : TASK_TEMPLATES,
          source: "supabase",
        };
      }
    } catch {
      // fall through to sample data
    }
  }

  return {
    deals: sampleDeals,
    listings: sampleListings,
    appointments: sampleAppointments,
    properties: sampleProperties,
    contacts: sampleContacts,
    activities: sampleActivities,
    tasks: [],
    templates: TASK_TEMPLATES,
    source: "sample",
  };
}

/**
 * Ensure every open deal has a task set. Persisted tasks win; open deals with
 * none get tasks generated from the templates on the fly (so Band 3 and the
 * milestone tracker work before the write-side of the deadline engine runs).
 */
function ensureTasks(
  deals: Deal[],
  persisted: Task[],
  templates: TaskTemplate[],
): Task[] {
  const dealsWithTasks = new Set(persisted.map((t) => t.deal_id));
  const generated: Task[] = [];
  for (const deal of deals) {
    if (deal.is_closed) continue;
    if (dealsWithTasks.has(deal.id)) continue;
    generated.push(...generateTasksForDeal(deal, templates));
  }
  return withTaskStatus([...persisted, ...generated]);
}

export async function getDashboardData(): Promise<DashboardData> {
  const raw = await loadRaw();
  const annualGoal = getAnnualGoal();

  const listings = withComputedFields(raw.listings);
  const tasks = ensureTasks(raw.deals, raw.tasks, raw.templates);

  const metrics = computeDashboardMetrics(
    raw.deals,
    listings,
    raw.appointments,
    annualGoal,
  );
  const band2 = computeBand2(raw.contacts, raw.deals, raw.activities);
  const band3 = computeBand3(raw.deals, listings, tasks, raw.properties);

  return {
    metrics,
    band2,
    band3,
    deals: raw.deals,
    listings,
    appointments: raw.appointments,
    properties: raw.properties,
    contacts: raw.contacts,
    tasks,
    activities: raw.activities,
    templates: raw.templates,
    source: raw.source,
    annualGoal,
  };
}

export function propertyById(
  properties: Property[],
  id: string | null,
): Property | undefined {
  if (!id) return undefined;
  return properties.find((p) => p.id === id);
}
