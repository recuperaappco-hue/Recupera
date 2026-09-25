-- Recupera database schema (pilot v0.1)
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-- One row per user. Created on first login.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  consent_version text,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Gmail connection. Holds the encrypted refresh token.
-- No RLS policies on purpose: only the server (service role) can read it.
create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  refresh_token_enc text not null,
  scope text,
  status text not null default 'active',          -- active | expired
  connected_at timestamptz not null default now(),
  last_scan_at timestamptz,
  last_scan_stats jsonb
);

-- Structured facts the AI extracted from emails. No email bodies are stored.
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_id text not null,
  kind text not null,               -- refund_promised, refund_received, charge, price_increase, trial_started, purchase_invoice, flight_cancelled, order_not_delivered, none
  merchant text,
  amount numeric,
  currency text,
  event_date date,
  due_date date,
  promised_business_days int,
  promised_calendar_days int,
  order_ref text,
  product text,
  price_from numeric,
  price_to numeric,
  warranty_months int,
  received_at timestamptz,
  subject text,
  sender text,
  snippet text,
  item_key text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, gmail_id, kind, item_key)
);
create index if not exists email_events_user on public.email_events(user_id);

-- What the user sees: money to recover and upcoming charges.
create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule text not null,               -- refund_pending, duplicate_charge, flight_cancelled, order_not_delivered, price_increase, trial_ending
  grp text not null,                -- money | alert
  title text not null,
  merchant text,
  amount numeric,
  amount_monthly numeric,
  price_from numeric,
  price_to numeric,
  due_date date,
  confidence text,                  -- high | medium
  summary text,
  checks jsonb not null default '[]',
  evidence jsonb not null default '[]',
  data jsonb not null default '{}',
  status text not null default 'open', -- open | claimed | paid | dismissed
  remind boolean not null default false,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists public.warranties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  store text,
  price numeric,
  bought_on date not null,
  until date not null,
  gmail_id text,
  remind boolean not null default false,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  short_id bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  warranty_id uuid references public.warranties(id) on delete set null,
  category text not null,
  merchant text,
  merchant_contact text,
  amount numeric,
  subject text,
  letter text not null,
  status text not null default 'authorized', -- authorized | sent | response | closed
  authorized_at timestamptz not null default now(),
  sent_at timestamptz,
  response_at timestamptz,
  response_summary text,
  recovered_amount numeric,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Row level security: each user sees only their own rows.
alter table public.profiles enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.email_events enable row level security;
alter table public.findings enable row level security;
alter table public.warranties enable row level security;
alter table public.cases enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own findings read" on public.findings;
create policy "own findings read" on public.findings for select using (auth.uid() = user_id);
drop policy if exists "own findings update" on public.findings;
create policy "own findings update" on public.findings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own warranties read" on public.warranties;
create policy "own warranties read" on public.warranties for select using (auth.uid() = user_id);
drop policy if exists "own warranties update" on public.warranties;
create policy "own warranties update" on public.warranties for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cases" on public.cases;
create policy "own cases" on public.cases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- email_events, gmail_connections and audit_log: server only (no policies).
