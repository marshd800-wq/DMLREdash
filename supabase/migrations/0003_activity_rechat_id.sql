-- ─────────────────────────────────────────────────────────────
-- Make the activity (touch) log idempotent for Rechat calendar sync.
--
-- Rechat's /calendar feed streams client activities and synced Gmail/Outlook
-- threads as calendar_events. We fan those into `activities` so the Band 2
-- cadence engine knows the real "last touch" per contact. Sync runs nightly,
-- so each touch needs a stable key to upsert on instead of duplicating.
--
-- rechat_id stays NULLABLE: manually logged touches have no Rechat id, and in
-- Postgres a UNIQUE index treats NULLs as distinct, so many manual rows coexist.
-- ─────────────────────────────────────────────────────────────

alter table activities add column if not exists rechat_id text;

create unique index if not exists activities_rechat_id_key
  on activities (rechat_id);
