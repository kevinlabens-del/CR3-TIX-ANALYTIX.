create table if not exists public.analytics_geo_cache (
  client_hash text primary key,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists analytics_geo_cache_expires_at_idx
  on public.analytics_geo_cache (expires_at);

alter table public.analytics_geo_cache enable row level security;

revoke all on table public.analytics_geo_cache from anon, authenticated;
