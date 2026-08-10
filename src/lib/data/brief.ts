import type { DashboardData } from "@/lib/data";
import { formatCompactCurrency, formatPercent } from "@/lib/utils";

/**
 * Morning Brief content (PRD §8) — ONE consolidated digest at 7:30 AM that
 * bundles everything non-urgent: how you're doing, who to call, and what's due.
 * Anti-spam by design: this is the bundle; only truly time-sensitive items fire
 * in real time.
 */

export interface BriefSection {
  heading: string;
  lines: string[];
}

export function buildBrief(data: DashboardData): {
  title: string;
  subtitle: string;
  sections: BriefSection[];
} {
  const { metrics, band2, band3 } = data;
  const pct =
    metrics.gci.annualGoal > 0
      ? metrics.gci.closedGci / metrics.gci.annualGoal
      : 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const howAmIDoing: BriefSection = {
    heading: "How you're doing",
    lines: [
      `GCI: ${formatCompactCurrency(metrics.gci.closedGci)} closed — ${formatPercent(pct)} of goal (${formatCompactCurrency(metrics.gci.pendingGci)} pending).`,
      `${metrics.appointments.thisWeek} appointments this week · ${metrics.underContract.count} under contract (${formatCompactCurrency(metrics.underContract.volume)}) · ${metrics.closingsThisMonth.count} closings this month.`,
    ],
  };

  const whoToCall: BriefSection = {
    heading: "Who to reach out to",
    lines: band2.callTheseTen.slice(0, 5).map(
      (i) => `${i.contact.first_name} ${i.contact.last_name} — ${i.reasonLabel} (${i.detail}).`,
    ),
  };
  if (whoToCall.lines.length === 0) whoToCall.lines.push("Nobody overdue — enjoy it.");

  const deadlines: BriefSection = {
    heading: "Deadlines this week",
    lines: band3.deadlinesThisWeek.slice(0, 6).map(
      (d) =>
        `${d.label} — ${d.address} (${d.daysAway === 0 ? "today" : `in ${d.daysAway}d`}).`,
    ),
  };
  if (deadlines.lines.length === 0) deadlines.lines.push("Nothing due in the next 14 days.");

  const overdue: BriefSection = {
    heading: "Overdue tasks",
    lines: band3.overdueTasks.slice(0, 6).map(
      (t) => `${t.title} — ${t.address ?? ""} (due ${t.due_date}).`,
    ),
  };
  if (overdue.lines.length === 0) overdue.lines.push("Nothing overdue. 🎉");

  return {
    title: `Good morning, Diana — ${today}`,
    subtitle: "Your one brief for the day. Everything non-urgent, bundled.",
    sections: [howAmIDoing, whoToCall, deadlines, overdue],
  };
}

/** Render the brief as a branded HTML email (Resend). */
export function briefToHtml(brief: ReturnType<typeof buildBrief>): string {
  const sections = brief.sections
    .map(
      (s) => `
      <tr><td style="padding:18px 24px 4px;">
        <div style="font:600 12px/1.4 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8A5A2B;">${s.heading}</div>
      </td></tr>
      <tr><td style="padding:0 24px 8px;">
        <ul style="margin:6px 0 0;padding-left:18px;color:#2C1F14;font:400 14px/1.6 Inter,Arial,sans-serif;">
          ${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
        </ul>
      </td></tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#F5F0E8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #C4A882;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:24px 24px 8px;border-bottom:1px solid #EDE3D5;">
            <div style="font:700 22px/1.2 Georgia,serif;color:#2C1F14;">${escapeHtml(brief.title)}</div>
            <div style="font:400 13px/1.5 Inter,Arial,sans-serif;color:#8A5A2B;margin-top:4px;">${escapeHtml(brief.subtitle)}</div>
          </td></tr>
          ${sections}
          <tr><td style="padding:20px 24px;border-top:1px solid #EDE3D5;text-align:center;">
            <div style="font:400 20px/1 'Brush Script MT',cursive;color:#A8562E;">Luxury With a Pulse</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
