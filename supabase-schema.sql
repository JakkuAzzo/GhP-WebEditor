create table if not exists webhook_events (
  delivery_id text primary key,
  event_name text not null,
  payload_hash text not null,
  processing_status text not null default 'received',
  error_message text,
  processed_at timestamptz default now()
);
create table if not exists subscriptions (
  github_purchase_id text primary key,
  github_account_id text not null,
  github_login text,
  github_plan_id text,
  plan_name text,
  billing_cycle text,
  state text not null,
  effective_date date,
  next_billing_date date,
  updated_at timestamptz default now()
);
create index if not exists subscriptions_account_idx on subscriptions(github_account_id, updated_at desc);

create table if not exists stripe_events (
  event_id text primary key,
  event_name text not null,
  payload_hash text not null,
  processing_status text not null default 'received',
  error_message text,
  processed_at timestamptz default now()
);

create table if not exists entitlements (
  entitlement_id text primary key,
  account_ref text not null,
  email text,
  plan_slug text not null,
  provider text not null,
  provider_reference text,
  state text not null,
  expires_at timestamptz,
  updated_at timestamptz default now()
);
create index if not exists entitlements_account_idx on entitlements(account_ref, state, updated_at desc);
