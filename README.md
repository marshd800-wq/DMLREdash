# Diana's OS

> Diana's whole business on one screen — pulling from **Rechat** and her **NOVA OS (Notion)** — so she always knows how she's doing, who to call, and what needs attention, without digging through six tools.

**Luxury With a Pulse** · Diana Marsh, REALTOR® · FOREVER Agent® · Berkshire Hathaway HomeServices Georgia Properties

Built with **Next.js (App Router) + TypeScript + Tailwind + Supabase**, deployable on Vercel. This repo implements **Phases 1 & 2** from the PRD and scaffolds the rest.

---

## What's built

**Phase 1 — the one-screen dashboard, Band 1 "How am I doing?"** (PRD §4):
- **GCI vs. annual goal** radial gauge (closed YTD + pending pipeline).
- **Appointments booked** this week/month + week-over-week trend.
- **Listings taken** MTD/YTD · **Under contract** (count + volume) · **Closings this month**.

**Phase 2 — the deadline engine + Bands 2 & 3 + Morning Brief:**
- **Deadline engine** (PRD §5, the heart) — under-contract deals auto-generate an anchored task checklist from side-keyed templates; moving any anchor date **cascades** every downstream due date (`due = anchor + offset`).
- **Band 2 "Who do I reach out to?"** — leads going cold, past clients due (incl. 1-year home anniversary), **reviews owed**, **referral asks owed** (the 4 triggers), and a blended **"Call these 10 today"** with one-tap call/text + script snippets.
- **Band 3 "What needs attention?"** — deadlines in the next 14 days, overdue tasks, stale listings (DOM > 21, no offer), new/at-risk deals.
- **Pipeline page** (`/deals`) — per-deal **milestone tracker** (Under Contract → Sold) with health dots + the live task checklist (PRD §6).
- **Morning Brief** (`/brief` preview + `/api/cron/morning-brief`) — one consolidated 7:30 AM digest, sent via Resend when configured (PRD §8), Vercel Cron wired (`vercel.json`).

**Foundation (both phases):**
- Full **brand shell** — logo, Playfair/Inter/Parisienne, the espresso/cream/terracotta palette (PRD §11).
- Complete **Supabase schema** for the whole data model (PRD §3) + seeded deadline templates (PRD §5).
- Clearly-labeled **Rechat** and **Notion** integration stubs (PRD §7).
- **Runs on sample data with zero setup** — a live badge flips to "Live" once Supabase is configured. Cadence rules, reviews/referrals-owed logic, and the deadline engine are all pure functions that behave identically on sample and live data.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000 — runs immediately on sample data
```

No environment variables are required to explore. To go live, copy `.env.example` → `.env.local` and fill in Supabase (and later Rechat/Notion) values.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint
```

## Going live with Supabase

1. Create a Supabase project.
2. Run the schema + seed:
   - `supabase/migrations/0001_init.sql` (tables, enums, indexes, triggers)
   - `supabase/seed.sql` (deadline-engine task templates)
3. Set in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side sync jobs)
   - `NEXT_PUBLIC_GCI_ANNUAL_GOAL` (defaults to 750000)

The dashboard reads live tables when configured and **falls back to sample data** if the tables are empty or unreachable — nothing blocks launch.

## Architecture

```
src/
  app/                     App Router — layout (fonts/brand), dashboard page
  components/
    brand/                 Header (logo + live badge), Footer (wordmark)
    dashboard/             Band1, GciGauge (Recharts), MetricCard, previews
    ui/                    small shadcn-style primitives (Card)
  lib/
    types.ts               domain types (mirror the SQL schema)
    data/
      index.ts             single data seam: Supabase-or-sample
      sample.ts            editable demo data (relative dates, always "current")
      metrics.ts           computed fields + Band-1 rollups (pure functions)
    integrations/
      rechat.ts            READ-sync stub (primary CRM / source of truth)
      notion.ts            NOS read-sync stub (polled)
    supabase/
      server.ts            SSR client; null when env is absent → sample fallback
    utils.ts               cn(), currency/number formatters
supabase/
  migrations/0001_init.sql full data model (PRD §3)
  seed.sql                 deadline-engine task templates (PRD §5)
```

**Design principle:** `getDashboardData()` is the only seam pages touch. Sample data and live Supabase data return identical shapes; computed fields (days-on-market, stale-flag, GCI, dashboard rollups) are applied there. When Rechat sync lands it writes into the same Supabase tables and nothing downstream changes.

## Roadmap (from the PRD)

- **Phase 1 — MVP:** brand shell + Band 1 "How am I doing?" on sample/Supabase data. ✅
- **Phase 2:** activities/touch log, cold-lead + past-client cadence, reviews/referrals owed, the **task & deadline engine + cascade**, Bands 2 & 3, milestone tracker, Morning Brief. ✅
- **Phase 3:** Rechat/Notion **write-side sync** (the stubs → real), Calendly + ShowingTime feeds, SMS (Twilio), client-facing "pizza tracker," one-tap call/text pulling scripts from the NOS.
- **Phase 4:** weekly auto-summary, price-drop suggestions on stale listings, NOS next-best-action.

## Going live

See **`docs/SETUP_SUPABASE.md`** for the step-by-step (Track A1). In short: create a Supabase project, run `supabase/migrations/0001_init.sql` + `supabase/seed.sql`, drop the URL + keys into `.env.local`, restart. The badge flips **Sample data → Live**. Live tables start empty — add rows in the Supabase Table Editor, or wait for Rechat sync (Phase 3) to fill them.
