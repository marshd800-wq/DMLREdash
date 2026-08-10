# Connecting Rechat — the go-live runbook

Diana's OS reads Diana's real book of business straight from Rechat: contacts,
deals, pipeline, deadlines, the touch log, and (via Rechat's email sync) inbox
threads. Everything in the code is finished and mapped against Rechat's real
API. The only thing standing between the sample dashboard and a live one is a
**partner OAuth app** issued by Rechat.

This doc is the whole path: what to ask Rechat for, where to put what they give
you, how to connect, and how to confirm it worked.

---

## The big picture (how the connection works)

Rechat is a **partner OAuth 2.0** platform. It is *not* self-serve — you don't
generate your own keys in a settings page. Rechat issues you a `client_id` +
`client_secret` for an app, tied to a **redirect URI** you give them. Then Diana
logs in through Rechat once, and the app holds a refresh token to keep syncing.

```
  Diana's OS  ──/api/auth/rechat/start──▶  app.rechat.com  (Diana logs in, picks her brand)
       ▲                                          │
       └────────/api/auth/rechat/callback ◀───────┘  (Rechat sends back a code + brand)
                        │
                        ▼
             exchanges code → access + refresh token  (stored in Supabase)
                        │
                        ▼
             api.rechat.com  ──▶  contacts, deals, listings, /calendar
```

Two hosts, on purpose:
- **`app.rechat.com`** — where the OAuth login lives (`RECHAT_AUTH_HOST`).
- **`api.rechat.com`** — where the data lives (`RECHAT_API_BASE`).

---

## Step 1 — Request the partner app from Rechat

Email your Rechat contact (or their partner/developer support). Ask for a
**partner OAuth application** with the **Authorization Code** grant, and give
them these three things:

1. **App name:** `Diana's OS` (or anything you like).
2. **Redirect URI** — this must match *exactly*, character for character:
   ```
   https://YOUR-APP-DOMAIN/api/auth/rechat/callback
   ```
   Use your real deployed domain (your Vercel URL, or a custom domain). For
   local testing you can *also* ask them to allow
   `http://localhost:3000/api/auth/rechat/callback`.
3. **Webhook URL** (so changes push in near-real-time between the 15-min syncs):
   ```
   https://YOUR-APP-DOMAIN/api/webhooks/rechat
   ```
   Ask them for the **webhook signing secret** for this endpoint.

What they send back:
- `client_id`
- `client_secret`
- **webhook signing secret**

> A draft email is at the bottom of this doc — copy/paste and fill the domain.

There are no scopes to pick and no keys to rotate on your side. The grant is
brand-scoped; Diana picks her brand during login and the app remembers it.

---

## Step 2 — Put the credentials in Vercel

In the Vercel project → **Settings → Environment Variables**, add these
(Production, and Preview if you test there). Names must match exactly:

| Variable | Value | Notes |
|---|---|---|
| `RECHAT_CLIENT_ID` | *(from Rechat)* | |
| `RECHAT_CLIENT_SECRET` | *(from Rechat)* | **secret — server-only, never in the browser** |
| `RECHAT_WEBHOOK_SECRET` | *(from Rechat)* | verifies incoming webhooks |
| `RECHAT_API_BASE` | `https://api.rechat.com` | default; only set to override |
| `RECHAT_AUTH_HOST` | `https://app.rechat.com` | default; only set to override |
| `APP_BASE_URL` | `https://YOUR-APP-DOMAIN` | used to build the redirect URI |
| `CRON_SECRET` | *(you invent this)* | any long random string; protects the cron endpoints |

`RECHAT_REDIRECT_URI` is optional — leave it unset and the app derives it from
`APP_BASE_URL` (`APP_BASE_URL + /api/auth/rechat/callback`). Only set it if your
callback lives on a different host than `APP_BASE_URL`. **Whatever the app ends
up using must equal the redirect URI you gave Rechat in Step 1.**

You should already have the Supabase variables set from `SETUP_SUPABASE.md`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`). Rechat tokens are stored in Supabase, so those
must be live for the connection to persist.

After adding variables, **redeploy** (Vercel → Deployments → Redeploy) so the
new environment is picked up.

---

## Step 3 — Run the database migrations

If you haven't already, run every file in `supabase/migrations/` in order in the
Supabase SQL editor:

1. `0001_init.sql` — the schema (contacts, deals, listings, tasks, …)
2. `0002_rechat_auth.sql` — the token store the OAuth flow writes to
3. `0003_activity_rechat_id.sql` — makes the touch log idempotent for calendar sync
4. `seed.sql` — the Georgia deadline task templates

(`0002` is required for the connection to persist — it's the table the refresh
token lives in.)

---

## Step 4 — Connect Diana's account (one time)

With the app deployed and the variables set, visit **once** in Diana's browser:

```
https://YOUR-APP-DOMAIN/api/auth/rechat/start
```

This bounces to `app.rechat.com`, where Diana logs in and selects her brand.
Rechat then redirects back to the callback, which:
- exchanges the code for an access + refresh token,
- stores them (and the brand id) in Supabase,
- kicks off a first sync,
- and lands back on the dashboard with `?rechat=connected`.

If something's off you'll land on `?rechat=error&reason=...` — the `reason` tells
you what to fix (a mismatched redirect URI is the usual first-try culprit).

---

## Step 5 — Verify it's live

1. **Load the dashboard.** The three bands should now show Diana's real numbers
   instead of the sample book.
2. **Hit the sync endpoint directly** to see counts (send the CRON_SECRET):
   ```
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
        https://YOUR-APP-DOMAIN/api/sync/rechat
   ```
   A healthy response looks like:
   ```json
   { "synced": true, "counts": { "contacts": 812, "deals": 6, "listings": 3,
     "activities": 240, "appointments": 18, "errors": [] } }
   ```
   `errors: []` is what you want. Anything in that array names the resource that
   failed and why — it won't crash the rest of the sync.
3. **Spot-check in Supabase** → Table editor → `contacts`, `deals`, `activities`
   should have rows.

After this, the app keeps itself current automatically:
- **Vercel Cron** hits `/api/sync/rechat` every 15 minutes (`vercel.json`).
- **Webhooks** push individual changes in between via `/api/webhooks/rechat`.
- The **morning brief** cron runs daily at 11:30 UTC.

---

## What flows in, and from where

| Dashboard band | Data | Rechat source |
|---|---|---|
| **Band 1 — How am I doing?** | GCI, pipeline, closings | Deals (`/deals/filter`) |
| **Band 2 — Who to reach out to?** | cadence, last touch, reviews, referrals | Contacts + `/calendar` activities & email threads |
| **Band 3 — What needs attention?** | deadlines, today's appointments, stale listings | Deals context + `/calendar` crm_tasks |

The "hiding in your inbox" signal (Gmail/Outlook) rides in through Rechat's
`/calendar` feed as `email_thread` events — **only if Diana has connected her
email inside Rechat.** If her inbox isn't linked in Rechat, that stays empty and
we'd add a direct email connector later.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `?rechat=error&reason=redirect_uri...` | The redirect URI in Vercel doesn't exactly match what Rechat has. Fix one to match the other (scheme, host, path, no trailing slash). |
| `Rechat not configured` from `/api/sync/rechat` | `RECHAT_CLIENT_ID` / `RECHAT_CLIENT_SECRET` missing or the deploy predates adding them — redeploy. |
| `Supabase is not configured` | `SUPABASE_SERVICE_ROLE_KEY` missing — the sync writes with the service-role key. |
| Sync `errors` mention `/deals/filter` or `/valerts` | The brand's context keys differ; note the message and we'll adjust the mapping. |
| Dashboard still shows sample data | No rows synced yet, or Supabase vars missing (the app falls back to sample data when Supabase isn't reachable). |
| `unauthorized` from the sync endpoint | Missing/incorrect `Authorization: Bearer <CRON_SECRET>` header. |

---

## Appendix — draft request email to Rechat

> **Subject:** Partner OAuth app request — Diana's OS
>
> Hi [Rechat contact],
>
> I'd like to request a **partner OAuth application** (Authorization Code grant)
> so my dashboard can read my Rechat data (contacts, deals, listings, calendar).
>
> - **App name:** Diana's OS
> - **Redirect URI:** `https://YOUR-APP-DOMAIN/api/auth/rechat/callback`
> - **Webhook URL:** `https://YOUR-APP-DOMAIN/api/webhooks/rechat`
>
> Could you send me the **client_id**, **client_secret**, and the **webhook
> signing secret** for the webhook endpoint? Also please allow
> `http://localhost:3000/api/auth/rechat/callback` as a second redirect URI for
> local testing, if possible.
>
> Thanks!
> Diana
