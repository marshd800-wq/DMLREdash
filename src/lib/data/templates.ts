import type { TaskTemplate } from "@/lib/types";

/**
 * Deadline-engine task templates (PRD §5) — mirror of supabase/seed.sql.
 * Kept here so the engine runs on sample data without a database. When
 * Supabase is configured, templates are read from the `task_templates` table
 * instead (see getDashboardData). Templates are DATA, not code: Diana can edit
 * rows without a developer.
 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  // ── Listing side (Georgia defaults) ──
  { id: "t-l-1", side: "listing", title: "Confirm earnest money received + receipted", anchor: "contract", offset_days: 3, sort_order: 10 },
  { id: "t-l-2", side: "listing", title: "Order/confirm inspections access", anchor: "contract", offset_days: 1, sort_order: 20 },
  { id: "t-l-3", side: "listing", title: "Due-diligence check-in with seller", anchor: "inspection", offset_days: -2, sort_order: 30 },
  { id: "t-l-4", side: "listing", title: "Repair-amendment follow-up", anchor: "inspection", offset_days: -1, sort_order: 40 },
  { id: "t-l-5", side: "listing", title: "Appraisal ordered / access confirmed", anchor: "financing", offset_days: -10, sort_order: 50 },
  { id: "t-l-6", side: "listing", title: "Appraisal result review", anchor: "appraisal", offset_days: 0, sort_order: 60 },
  { id: "t-l-7", side: "listing", title: "Financing clear check w/ lender", anchor: "financing", offset_days: -2, sort_order: 70 },
  { id: "t-l-8", side: "listing", title: "Utilities/HOA/closing docs prep", anchor: "closing", offset_days: -7, sort_order: 80 },
  { id: "t-l-9", side: "listing", title: "Final walkthrough scheduled", anchor: "closing", offset_days: -2, sort_order: 90 },
  { id: "t-l-10", side: "listing", title: "Closing day + keys", anchor: "closing", offset_days: 0, sort_order: 100 },
  { id: "t-l-11", side: "listing", title: "Next-day review + referral ask", anchor: "closing", offset_days: 1, sort_order: 110 },

  // ── Buyer side (starter set) ──
  { id: "t-b-1", side: "buyer", title: "Confirm earnest money delivered + receipted", anchor: "contract", offset_days: 3, sort_order: 10 },
  { id: "t-b-2", side: "buyer", title: "Schedule inspections", anchor: "contract", offset_days: 1, sort_order: 20 },
  { id: "t-b-3", side: "buyer", title: "Due-diligence review with buyer", anchor: "inspection", offset_days: -2, sort_order: 30 },
  { id: "t-b-4", side: "buyer", title: "Submit repair amendment if needed", anchor: "inspection", offset_days: -1, sort_order: 40 },
  { id: "t-b-5", side: "buyer", title: "Confirm appraisal ordered by lender", anchor: "financing", offset_days: -10, sort_order: 50 },
  { id: "t-b-6", side: "buyer", title: "Appraisal result review", anchor: "appraisal", offset_days: 0, sort_order: 60 },
  { id: "t-b-7", side: "buyer", title: "Financing / clear-to-close check w/ lender", anchor: "financing", offset_days: -2, sort_order: 70 },
  { id: "t-b-8", side: "buyer", title: "Final walkthrough scheduled", anchor: "closing", offset_days: -2, sort_order: 80 },
  { id: "t-b-9", side: "buyer", title: "Closing day + keys", anchor: "closing", offset_days: 0, sort_order: 90 },
  { id: "t-b-10", side: "buyer", title: "Next-day review + referral ask", anchor: "closing", offset_days: 1, sort_order: 100 },
];
