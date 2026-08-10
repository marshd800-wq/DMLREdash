-- ─────────────────────────────────────────────────────────────
-- Diana's OS — initial schema (PRD §3 data model)
-- Postgres / Supabase. rechat_id is the dedupe/join key against Rechat;
-- notion_id links NOVA OS (NOS) records. Computed fields (days_on_market,
-- stale_flag, gci, last_touch_at, next_touch_due, task status) are derived in
-- the app layer so the templates/rules stay editable without a migration.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── enums ──────────────────────────────────────────────────────
do $$ begin
  create type contact_type as enum ('lead','active_client','past_client','sphere','agent','vendor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contact_heat as enum ('new','warm','cold','nurture');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_side as enum ('listing','buyer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_status as enum
    ('under_contract','inspection','appraisal','financing','clear_to_close','closing','sold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('active','pending','sold','expired','withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_type as enum ('consult','listing','showing','closing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_source as enum ('calendly','rechat','manual','google');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_anchor as enum ('contract','inspection','appraisal','financing','closing','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_source as enum ('template','notion','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum ('call','text','email','meeting','note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum ('sent','viewed','signed');
exception when duplicate_object then null; end $$;

-- ── contacts ───────────────────────────────────────────────────
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  rechat_id text unique,
  notion_id text,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  type contact_type not null default 'lead',
  heat contact_heat not null default 'new',
  source text,
  last_touch_at timestamptz,          -- computed from activities
  next_touch_due date,                -- computed by cadence rules
  referral_source_id uuid references contacts(id),
  review_asked_at date,
  referral_asked_at date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── properties ─────────────────────────────────────────────────
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  rechat_id text unique,
  notion_id text,
  address text not null,
  city text,
  state text,
  zip text,
  beds numeric,
  baths numeric,
  sqft numeric,
  list_price numeric,
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── deals (transactions) ───────────────────────────────────────
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  rechat_id text unique,
  property_id uuid references properties(id),
  contact_id uuid references contacts(id),
  side deal_side not null,
  status deal_status not null default 'under_contract',
  price numeric not null default 0,
  commission_rate numeric not null default 0.03,
  gci numeric generated always as (round(price * commission_rate)) stored,
  binding_date date,
  dd_end date,
  financing_end date,
  appraisal_end date,
  closing_date date,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── listings ───────────────────────────────────────────────────
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  rechat_id text unique,
  property_id uuid references properties(id),
  list_date date not null,
  status listing_status not null default 'active',
  last_price_change date,
  showings_count int default 0,
  feedback_summary text,
  -- days_on_market & stale_flag are computed in the app (they depend on "today").
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── tasks (deadline engine) ────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  notion_id text,
  rechat_id text,
  deal_id uuid references deals(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  anchor task_anchor not null default 'manual',
  offset_days int not null default 0,
  status text not null default 'open',   -- open | done | overdue (overdue computed)
  source task_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── appointments ───────────────────────────────────────────────
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  rechat_id text unique,
  contact_id uuid references contacts(id),
  deal_id uuid references deals(id),
  type appointment_type not null default 'consult',
  starts_at timestamptz not null,
  source appointment_source not null default 'manual',
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

-- ── activities (touch log — powers cold-lead + last-touch) ─────
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  type activity_type not null,
  occurred_at timestamptz not null default now(),
  channel text,
  notes text
);

-- ── vendors ────────────────────────────────────────────────────
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,           -- lender | inspector | title | photographer | stager
  phone text,
  email text,
  notes text
);

-- ── documents ──────────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  name text not null,
  type text,
  status document_status not null default 'sent',
  source text,             -- rechat | docusign
  url text,
  created_at timestamptz not null default now()
);

-- ── task templates (deadline engine — PRD §5; data, not code) ──
create table if not exists task_templates (
  id uuid primary key default gen_random_uuid(),
  side deal_side not null,
  title text not null,
  anchor task_anchor not null,
  offset_days int not null,
  sort_order int not null default 0
);

-- ── agents (v1 solo stub — kept so team support needs no migration) ──
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  role text default 'agent',
  created_at timestamptz not null default now()
);

-- ── indexes ────────────────────────────────────────────────────
create index if not exists idx_deals_status on deals(status);
create index if not exists idx_deals_closing on deals(closing_date);
create index if not exists idx_listings_status on listings(status);
create index if not exists idx_appointments_starts on appointments(starts_at);
create index if not exists idx_activities_contact on activities(contact_id, occurred_at);
create index if not exists idx_tasks_deal on tasks(deal_id, due_date);
create index if not exists idx_contacts_heat on contacts(heat, next_touch_due);

-- ── updated_at trigger ─────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['contacts','properties','deals','listings','tasks']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on %1$s;
       create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ── Row Level Security ─────────────────────────────────────────
-- Enable RLS on every table with NO public policies. The app reaches the DB
-- only server-side via the service_role key (which bypasses RLS), so this locks
-- the tables to the anon/authenticated keys — protecting client PII. When
-- Supabase Auth is added later (PRD §2), add per-user policies here.
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','properties','deals','listings','tasks','appointments',
    'activities','vendors','documents','task_templates','agents'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
