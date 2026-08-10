# Track A1 — Stand up Supabase (go from "Sample data" → "Live")

**Time:** ~15 minutes · **Cost:** free tier is plenty to start · **You need:** just an email address.

When you finish this, the badge in the top-right of Diana's OS flips from **"Sample data"** to **"Live"**, and the dashboard reads from your own database instead of the built-in demo data.

---

## Step 1 — Create a Supabase project

1. Go to **https://supabase.com** and click **Start your project** (sign in with GitHub or email).
2. Click **New project**.
3. Fill in:
   - **Name:** `dianas-os`
   - **Database Password:** click **Generate a password**, then **copy it somewhere safe** (a password manager). You rarely need it again, but don't lose it.
   - **Region:** pick the one closest to Atlanta — **East US (North Virginia)**.
4. Click **Create new project** and wait ~2 minutes while it provisions.

---

## Step 2 — Run the schema (creates all the tables)

1. In the left sidebar, click the **SQL Editor** icon (looks like `</>`).
2. Click **+ New query**.
3. Open the file **`supabase/migrations/0001_init.sql`** from this repo, **copy its entire contents**, and paste into the editor.
4. Click **Run** (bottom-right, or Cmd/Ctrl+Enter).
5. You should see **"Success. No rows returned."** — that's correct; it just built the tables.

Then load the deadline-engine templates:

6. Click **+ New query** again.
7. Open **`supabase/seed.sql`**, copy all of it, paste, and click **Run**.
8. Success again. (This loads the Georgia listing/buyer task checklists.)

> ✅ **Check it worked:** click **Table Editor** in the sidebar — you should see `contacts`, `deals`, `listings`, `tasks`, `task_templates`, and the rest. Open `task_templates` and you'll see ~21 rows.

---

## Step 3 — Grab your two keys

1. In the left sidebar, click the **gear ⚙️ (Project Settings)** at the bottom.
2. Click **API** (under "Configuration").
3. You'll see two things to copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Project API keys → `anon` `public`** — a long string starting with `eyJ...`
   - **Project API keys → `service_role` `secret`** — click **Reveal**, another long `eyJ...` string.

> 🔒 The `service_role` key is a **master key** — it bypasses all security. Never paste it into the browser code, a screenshot, Slack, or a public repo. It only ever lives in your private `.env.local` / Vercel settings. The `anon` key is safe to expose in the app.

---

## Step 4 — Put the keys into the app

In the project folder, create a file named **`.env.local`** (copy from `.env.example`) and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
NEXT_PUBLIC_GCI_ANNUAL_GOAL=750000
```

Set `NEXT_PUBLIC_GCI_ANNUAL_GOAL` to Diana's real annual GCI goal (in dollars, no commas).

Then restart the app:

```bash
npm run dev
```

Open **http://localhost:3000**. The badge should now read **"Live"**.

> Your database is empty at first, so the numbers will be zero — that's expected and correct. The OS falls back to sample data only when it can't reach Supabase at all; once connected, it shows *your* data. Rechat sync (Track A2) is what fills these tables automatically. Until then you can add a few rows by hand in the **Table Editor** to see it light up.

---

## Step 5 (later) — Same keys go into Vercel

When you deploy (Track A4), add these **exact same four variables** in **Vercel → Project → Settings → Environment Variables**. That's what makes the live site read your database too.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Badge still says "Sample data" | The app only reads env vars at startup — stop (`Ctrl+C`) and re-run `npm run dev`. Confirm no typos in the variable names. |
| SQL error "type already exists" | Harmless — the script is safe to re-run; it guards against duplicates. |
| Numbers are all zero after connecting | Correct — your DB is empty. Add rows in Table Editor, or wait for Rechat sync (A2). |
| "permission denied for table" | You ran the app with the `anon` key but Row Level Security is on with no policy. For a single-user solo app you can leave RLS off (default here). Don't enable RLS without adding policies. |

---

**Done?** The moment the badge says "Live," Track A1 is complete. Next highest-leverage items: **A2 (request Rechat credentials — long lead time, start it now)** and **A4 (deploy to Vercel)**.
