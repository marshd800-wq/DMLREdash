-- ─────────────────────────────────────────────────────────────
-- Diana's OS — Rechat OAuth token storage
-- Partner integrations use the Authorization Code flow: a one-time browser
-- authorization yields a refresh token, which the server uses to mint access
-- tokens for the ongoing headless sync. We persist that single token set here
-- (one row) so it survives serverless restarts. Locked by RLS — only the
-- service_role key (server) can read it.
-- ─────────────────────────────────────────────────────────────

create table if not exists rechat_auth (
  id int primary key default 1,
  access_token text,
  refresh_token text,
  brand_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint rechat_auth_singleton check (id = 1)
);

alter table rechat_auth enable row level security;
