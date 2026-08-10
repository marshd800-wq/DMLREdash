# Diana's OS

> Diana's whole business on one screen — pulling from **Rechat** and her **NOVA OS (Notion)** — so she always knows how she's doing, who to call, and what needs attention, without digging through six tools.

**Luxury With a Pulse** · Diana Marsh, REALTOR® · FOREVER Agent® · Berkshire Hathaway HomeServices Georgia Properties

Built with **Next.js (App Router) + TypeScript + Tailwind + Supabase**, deployable on Vercel. This repo currently implements **Phase 1 (MVP)** from the PRD and scaffolds the rest.

---

## What's built (Phase 1 — MVP)

The one-screen command dashboard answering **Question 1 — "How am I doing?"** (PRD §4, Band 1):

- **GCI vs. annual goal** — radial gauge (closed YTD, with pending pipeline as the "on pace to" figure).
- **Appointments booked** — this week / month + week-over-week trend (the #1 leading indicator).
- **Listings taken** — MTD / YTD.
- **Under contract** — deal count + pipeline volume.
- **Closings this month** — count + volume.

Plus:
- Full **brand shell** — logo, Playfair/Inter/Parisienne fonts, the espresso/cream/terracotta palette (PRD §11).
- The complete **Supabase schema** for the whole data model (PRD §3), not just Phase 1.
- **Deadline-engine task templates** seeded (Georgia listing/buyer defaults, PRD §5) — data, not code.
- Clearly-labeled **Rechat** and **Notion** integration stubs (PRD §7).
- **Runs on sample data with zero setup** — a live badge flips to "Live" once Supabase is configured.
- An outline of **Bands 2 & 3** so the full one-screen structure is visible (ships in Phase 2).

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

- **Phase 1 — MVP (this repo):** brand shell + Band 1 "How am I doing?" on sample/Supabase data. ✅
- **Phase 2:** Notion (NOS) sync, activities/touch log, cold-lead + past-client cadence, reviews/referrals owed, the **task & deadline engine + cascade**, Bands 2 & 3, Morning Brief email.
- **Phase 3:** Calendly + ShowingTime feeds, SMS, milestone tracker + client-facing "pizza tracker," one-tap call/text.
- **Phase 4:** weekly auto-summary, price-drop suggestions, NOS next-best-action.
