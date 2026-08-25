-- CR3@TIX ANALYTIX — additive analytics schema for the existing CR3ATIX-MAP project.
-- This migration never drops or rewrites MAP data.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists analytix_private;
revoke all on schema analytix_private from public, anon, authenticated;

create table if not exists public.analytics_projects (
  id uuid primary key default gen_random_uuid(),
  source_node_id text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  url text not null check (url ~ '^https://'),
  repository_url text check (repository_url is null or repository_url ~ '^https://github.com/'),
  category text not null default 'PROJET',
  description text not null default '',
  version text,
  added_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  analytics_enabled boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING','ONLINE','DEGRADED','DOWN','ARCHIVED')),
  tracking_key uuid not null default gen_random_uuid() unique,
  allowed_origins text[] not null default '{}',
  last_event_at timestamptz,
  tracker_last_seen_at timestamptz,
  map_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(map_metadata)='object')
);

create table if not exists public.analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_bootstrap (
  id boolean primary key default true check (id),
  token_hash text not null,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_internal_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_visitors (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  visitor_id uuid not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_source text,
  first_campaign text,
  visit_count integer not null default 1 check (visit_count >= 1),
  primary key (project_id, visitor_id)
);

create table if not exists public.analytics_sessions (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  session_id uuid not null,
  visitor_id uuid not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  pageviews integer not null default 0 check (pageviews >= 0),
  events_count integer not null default 0 check (events_count >= 0),
  entry_page text,
  exit_page text,
  source text,
  medium text,
  campaign text,
  device_type text,
  country_code text,
  is_bounce boolean not null default true,
  primary key (project_id, session_id),
  foreign key (project_id, visitor_id) references public.analytics_visitors(project_id, visitor_id) on delete restrict
);

create table if not exists public.analytics_events (
  id uuid primary key,
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  session_id uuid not null,
  visitor_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  page_path text not null default '/',
  page_title text,
  referrer text,
  source text,
  medium text,
  campaign text,
  country_code text,
  device_type text,
  browser text,
  os text,
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties)='object' and octet_length(properties::text) <= 8192),
  foreign key (project_id, session_id) references public.analytics_sessions(project_id, session_id) on delete restrict
);

create table if not exists public.analytics_daily_visitors (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  day date not null,
  visitor_id uuid not null,
  primary key (project_id, day, visitor_id)
);

create table if not exists public.analytics_daily_stats (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  day date not null,
  visitors integer not null default 0,
  new_visitors integer not null default 0,
  sessions integer not null default 0,
  pageviews integer not null default 0,
  events integer not null default 0,
  conversions integer not null default 0,
  installs integer not null default 0,
  engaged_seconds bigint not null default 0,
  errors integer not null default 0,
  primary key (project_id, day)
);

create table if not exists public.analytics_daily_dimensions (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  day date not null,
  dimension text not null,
  value text not null,
  events integer not null default 0,
  sessions integer not null default 0,
  conversions integer not null default 0,
  primary key (project_id, day, dimension, value)
);

create table if not exists public.analytics_errors (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  fingerprint text not null,
  error_type text not null,
  message text not null,
  page_path text,
  browser text,
  os text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  occurrences bigint not null default 1,
  resolved_at timestamptz,
  primary key (project_id, fingerprint)
);

create table if not exists public.analytics_performance (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  page_path text not null,
  metric text not null check (metric in ('LCP','INP','CLS','TTFB','LOAD')),
  value numeric(12,3) not null check (value >= 0),
  rating text check (rating in ('good','needs-improvement','poor')),
  device_type text
);

create table if not exists public.analytics_campaigns (
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  day date not null,
  utm_source text not null default '(not set)',
  utm_medium text not null default '(not set)',
  utm_campaign text not null default '(not set)',
  utm_content text not null default '(not set)',
  utm_term text not null default '(not set)',
  sessions integer not null default 0,
  events integer not null default 0,
  conversions integer not null default 0,
  primary key (project_id, day, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
);

create table if not exists public.analytics_health (
  project_id uuid primary key references public.analytics_projects(id) on delete restrict,
  status text not null default 'DEGRADED' check (status in ('ONLINE','DEGRADED','DOWN')),
  checked_at timestamptz not null default now(),
  http_status integer,
  response_ms integer,
  https_ok boolean,
  tracker_ok boolean,
  manifest_ok boolean,
  service_worker_ok boolean,
  last_event_at timestamptz,
  version text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.analytics_health_history (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.analytics_projects(id) on delete restrict,
  status text not null check (status in ('ONLINE','DEGRADED','DOWN')),
  checked_at timestamptz not null default now(),
  http_status integer,
  response_ms integer,
  tracker_ok boolean
);

create table if not exists public.analytics_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.analytics_projects(id) on delete restrict,
  kind text not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  message text not null,
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  dedupe_key text
);

create table if not exists public.analytics_rate_limits (
  project_id uuid not null references public.analytics_projects(id) on delete cascade,
  client_hash text not null,
  bucket timestamptz not null,
  event_count integer not null default 0,
  primary key (project_id, client_hash, bucket)
);

create index if not exists analytics_events_project_time_idx on public.analytics_events(project_id, occurred_at desc);
create index if not exists analytics_events_project_type_time_idx on public.analytics_events(project_id, event_type, occurred_at desc);
create index if not exists analytics_sessions_project_time_idx on public.analytics_sessions(project_id, last_seen_at desc);
create index if not exists analytics_sessions_active_idx on public.analytics_sessions(project_id, last_seen_at desc) where ended_at is null;
create index if not exists analytics_dimensions_lookup_idx on public.analytics_daily_dimensions(project_id, dimension, day desc);
create index if not exists analytics_performance_lookup_idx on public.analytics_performance(project_id, metric, recorded_at desc);
create index if not exists analytics_alerts_open_idx on public.analytics_alerts(project_id, created_at desc) where status='OPEN';
create unique index if not exists analytics_alerts_dedupe_open_idx on public.analytics_alerts(dedupe_key) where status='OPEN' and dedupe_key is not null;
create index if not exists analytics_health_history_lookup_idx on public.analytics_health_history(project_id, checked_at desc);

create or replace function analytix_private.is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.analytics_admins where user_id=auth.uid()) $$;
revoke all on function analytix_private.is_admin() from public;
grant execute on function analytix_private.is_admin() to authenticated;

create or replace function analytix_private.slugify(value text)
returns text language sql immutable strict set search_path=pg_catalog
as $$ select trim(both '-' from regexp_replace(lower(translate(value,'@’''éèêëàâäùûüôöîïç','a--eeeeaaauuuooiic')),'[^a-z0-9]+','-','g')) $$;

create or replace function analytix_private.sync_projects_from_map(map_nodes jsonb)
returns integer language plpgsql security definer set search_path=public,analytix_private,pg_temp
as $$
declare
  node jsonb;
  node_id text;
  node_url text;
  node_slug text;
  repo text;
  origin text;
  seen text[] := '{}';
  synced integer := 0;
begin
  if jsonb_typeof(map_nodes) <> 'array' then return 0; end if;
  for node in select value from jsonb_array_elements(map_nodes)
  loop
    node_url := nullif(node->>'url','');
    node_id := nullif(node->>'id','');
    if node_url is null or node_id is null or node_url !~ '^https://' then continue; end if;
    node_slug := analytix_private.slugify(coalesce(node->>'title',node_id));
    if node_slug = '' then node_slug := 'project-'||substr(md5(node_id),1,8); end if;
    if node_url ~* '^https://kevinlabens-del\.github\.io/[^/]+/?' then
      repo := 'https://github.com/kevinlabens-del/' || substring(node_url from 'github\.io/([^/]+)');
    else repo := null; end if;
    origin := substring(node_url from '^(https://[^/]+)');
    insert into public.analytics_projects(source_node_id,slug,name,url,repository_url,category,description,version,analytics_enabled,status,allowed_origins,map_metadata)
    values(node_id,node_slug,left(coalesce(node->>'title',node_id),120),node_url,repo,left(coalesce(node->>'type','PROJET'),60),left(coalesce(node->>'desc',''),1000),node->>'version',true,
      case upper(coalesce(node->>'status','PENDING')) when 'ONLINE' then 'ONLINE' when 'DOWN' then 'DOWN' else 'PENDING' end,
      array[origin],node)
    on conflict(source_node_id) do update set
      slug=excluded.slug,name=excluded.name,url=excluded.url,repository_url=excluded.repository_url,category=excluded.category,
      description=excluded.description,version=coalesce(excluded.version,analytics_projects.version),modified_at=now(),
      status=case when analytics_projects.status='ARCHIVED' then 'PENDING' else excluded.status end,
      allowed_origins=excluded.allowed_origins,map_metadata=excluded.map_metadata;
    seen := array_append(seen,node_id); synced := synced+1;
  end loop;
  update public.analytics_projects set status='ARCHIVED',analytics_enabled=false,modified_at=now()
    where source_node_id <> all(seen) and status <> 'ARCHIVED';
  return synced;
end $$;

create or replace function public.analytics_force_registry_sync()
returns integer language plpgsql security definer set search_path=public,analytix_private,pg_temp
as $$ declare result integer; begin
  select analytix_private.sync_projects_from_map(nodes) into result from public.cr3atix_project_state where id='main';
  return coalesce(result,0);
end $$;
revoke all on function public.analytics_force_registry_sync() from public,anon,authenticated;
grant execute on function public.analytics_force_registry_sync() to service_role;

create or replace function analytix_private.map_sync_trigger()
returns trigger language plpgsql security definer set search_path=public,analytix_private,pg_temp
as $$ begin
  begin perform analytix_private.sync_projects_from_map(new.nodes);
  exception when others then raise warning 'ANALYTIX registry sync skipped: %',sqlerrm; end;
  return new;
end $$;
drop trigger if exists cr3atix_analytix_registry_sync on public.cr3atix_project_state;
create trigger cr3atix_analytix_registry_sync after insert or update of nodes on public.cr3atix_project_state
for each row when (new.id='main') execute function analytix_private.map_sync_trigger();

create or replace function public.analytics_ingest_batch(
  p_project_id uuid,p_visitor_id uuid,p_session_id uuid,p_events jsonb,p_context jsonb,p_client_hash text,p_country_code text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  item jsonb; v_event_id uuid; v_type text; v_time timestamptz; v_path text; v_props jsonb;
  v_day date; v_count integer; v_is_new boolean; v_new_daily boolean; v_pageviews integer:=0; v_engaged integer:=0;
  v_source text:=left(coalesce(p_context->>'source','Direct'),120); v_medium text:=left(coalesce(p_context->>'medium','(none)'),120);
  v_campaign text:=left(coalesce(p_context->>'utm_campaign','(not set)'),160); v_device text:=left(coalesce(p_context->>'device_type','unknown'),40);
  v_first_time timestamptz:=now();
begin
  if jsonb_typeof(p_events)<>'array' then raise exception 'events_must_be_array'; end if;
  v_count:=jsonb_array_length(p_events); if v_count<1 or v_count>20 then raise exception 'invalid_batch_size'; end if;
  if not exists(select 1 from public.analytics_projects where id=p_project_id and analytics_enabled and status<>'ARCHIVED') then raise exception 'project_disabled'; end if;
  insert into public.analytics_rate_limits(project_id,client_hash,bucket,event_count)
  values(p_project_id,left(p_client_hash,96),date_trunc('minute',now()),v_count)
  on conflict(project_id,client_hash,bucket) do update set event_count=analytics_rate_limits.event_count+excluded.event_count
  returning event_count into v_count;
  if v_count>240 then raise exception 'rate_limited'; end if;

  select first_seen_at into v_first_time from public.analytics_visitors where project_id=p_project_id and visitor_id=p_visitor_id;
  v_is_new:=not found;
  insert into public.analytics_visitors(project_id,visitor_id,first_seen_at,last_seen_at,first_source,first_campaign)
  values(p_project_id,p_visitor_id,now(),now(),v_source,nullif(v_campaign,'(not set)'))
  on conflict(project_id,visitor_id) do update set last_seen_at=excluded.last_seen_at,
    visit_count=case when analytics_visitors.last_seen_at < now()-interval '30 minutes' then analytics_visitors.visit_count+1 else analytics_visitors.visit_count end;

  insert into public.analytics_sessions(project_id,session_id,visitor_id,started_at,last_seen_at,entry_page,exit_page,source,medium,campaign,device_type,country_code)
  values(p_project_id,p_session_id,p_visitor_id,now(),now(),left(coalesce(p_context->>'page_path','/'),500),left(coalesce(p_context->>'page_path','/'),500),v_source,v_medium,nullif(v_campaign,'(not set)'),v_device,left(p_country_code,2))
  on conflict(project_id,session_id) do update set last_seen_at=now(),exit_page=excluded.exit_page;

  for item in select value from jsonb_array_elements(p_events)
  loop
    begin v_event_id:=coalesce((item->>'id')::uuid,gen_random_uuid()); exception when others then v_event_id:=gen_random_uuid(); end;
    v_type:=left(lower(coalesce(item->>'type','custom')),64);
    if v_type !~ '^[a-z][a-z0-9_]{0,63}$' then continue; end if;
    begin v_time:=(item->>'timestamp')::timestamptz; exception when others then v_time:=now(); end;
    if v_time<now()-interval '24 hours' or v_time>now()+interval '5 minutes' then v_time:=now(); end if;
    v_day:=(v_time at time zone 'UTC')::date;
    v_path:=left(coalesce(item->>'path',p_context->>'page_path','/'),500);
    v_props:=coalesce(item->'properties','{}'::jsonb);
    if jsonb_typeof(v_props)<>'object' or octet_length(v_props::text)>8192 then v_props:='{}'::jsonb; end if;
    insert into public.analytics_events(id,project_id,session_id,visitor_id,event_type,occurred_at,page_path,page_title,referrer,source,medium,campaign,country_code,device_type,browser,os,properties)
    values(v_event_id,p_project_id,p_session_id,p_visitor_id,v_type,v_time,v_path,left(item->>'title',300),left(p_context->>'referrer',500),v_source,v_medium,nullif(v_campaign,'(not set)'),left(p_country_code,2),v_device,left(p_context->>'browser',80),left(p_context->>'os',80),v_props)
    on conflict(id) do nothing;
    if not found then continue; end if;
    v_pageviews:=v_pageviews+(v_type='pageview')::int;
    if v_type='engagement' then v_engaged:=v_engaged+least(greatest(coalesce((v_props->>'seconds')::int,0),0),300); end if;
    insert into public.analytics_daily_visitors(project_id,day,visitor_id) values(p_project_id,v_day,p_visitor_id) on conflict do nothing;
    v_new_daily:=found;
    insert into public.analytics_daily_stats(project_id,day,visitors,new_visitors,sessions,pageviews,events,conversions,installs,engaged_seconds,errors)
    values(p_project_id,v_day,v_new_daily::int,(v_new_daily and v_is_new)::int,(v_type='session_start')::int,(v_type='pageview')::int,1,(v_type in ('conversion','purchase','signup'))::int,(v_type='install')::int,case when v_type='engagement' then least(greatest(coalesce((v_props->>'seconds')::int,0),0),300) else 0 end,(v_type in ('js_error','unhandled_rejection'))::int)
    on conflict(project_id,day) do update set visitors=analytics_daily_stats.visitors+excluded.visitors,new_visitors=analytics_daily_stats.new_visitors+excluded.new_visitors,
      sessions=analytics_daily_stats.sessions+excluded.sessions,pageviews=analytics_daily_stats.pageviews+excluded.pageviews,events=analytics_daily_stats.events+1,
      conversions=analytics_daily_stats.conversions+excluded.conversions,installs=analytics_daily_stats.installs+excluded.installs,
      engaged_seconds=analytics_daily_stats.engaged_seconds+excluded.engaged_seconds,errors=analytics_daily_stats.errors+excluded.errors;
    insert into public.analytics_daily_dimensions(project_id,day,dimension,value,events,sessions,conversions)
    select p_project_id,v_day,d.dimension,left(coalesce(d.value,'(not set)'),160),1,(v_type='session_start')::int,(v_type in ('conversion','purchase','signup'))::int
    from (values ('event',v_type),('page',v_path),('source',v_source),('device',v_device),('browser',p_context->>'browser'),('os',p_context->>'os'),('country',p_country_code)) d(dimension,value)
    where d.value is not null and d.value<>''
    on conflict(project_id,day,dimension,value) do update set events=analytics_daily_dimensions.events+1,sessions=analytics_daily_dimensions.sessions+excluded.sessions,conversions=analytics_daily_dimensions.conversions+excluded.conversions;
    if v_type in ('js_error','unhandled_rejection') then
      insert into public.analytics_errors(project_id,fingerprint,error_type,message,page_path,browser,os,first_seen_at,last_seen_at)
      values(p_project_id,left(coalesce(v_props->>'fingerprint',encode(digest(coalesce(v_props->>'message','unknown'),'sha256'),'hex')),64),v_type,left(coalesce(v_props->>'message','Erreur inconnue'),500),v_path,left(p_context->>'browser',80),left(p_context->>'os',80),v_time,v_time)
      on conflict(project_id,fingerprint) do update set last_seen_at=excluded.last_seen_at,occurrences=analytics_errors.occurrences+1;
    end if;
    if v_type='web_vital' and v_props->>'metric' in ('LCP','INP','CLS','TTFB','LOAD') then
      insert into public.analytics_performance(project_id,recorded_at,page_path,metric,value,rating,device_type)
      values(p_project_id,v_time,v_path,v_props->>'metric',least(greatest((v_props->>'value')::numeric,0),999999),nullif(v_props->>'rating',''),v_device);
    end if;
    if v_type='session_start' or nullif(p_context->>'utm_source','') is not null then
      insert into public.analytics_campaigns(project_id,day,utm_source,utm_medium,utm_campaign,utm_content,utm_term,sessions,events,conversions)
      values(p_project_id,v_day,left(coalesce(nullif(p_context->>'utm_source',''),v_source,'(not set)'),120),left(coalesce(nullif(p_context->>'utm_medium',''),v_medium,'(not set)'),120),v_campaign,left(coalesce(nullif(p_context->>'utm_content',''),'(not set)'),160),left(coalesce(nullif(p_context->>'utm_term',''),'(not set)'),160),(v_type='session_start')::int,1,(v_type in ('conversion','purchase','signup'))::int)
      on conflict(project_id,day,utm_source,utm_medium,utm_campaign,utm_content,utm_term) do update set sessions=analytics_campaigns.sessions+excluded.sessions,events=analytics_campaigns.events+1,conversions=analytics_campaigns.conversions+excluded.conversions;
    end if;
  end loop;
  update public.analytics_sessions set last_seen_at=now(),duration_seconds=greatest(0,extract(epoch from now()-started_at)::int),pageviews=pageviews+v_pageviews,events_count=events_count+jsonb_array_length(p_events),exit_page=left(coalesce(p_context->>'page_path',exit_page),500),is_bounce=(pageviews+v_pageviews<=1 and events_count+jsonb_array_length(p_events)<=2)
  where project_id=p_project_id and session_id=p_session_id;
  update public.analytics_projects set last_event_at=now(),tracker_last_seen_at=now(),modified_at=modified_at where id=p_project_id;
  return jsonb_build_object('accepted',jsonb_array_length(p_events),'server_time',now());
end $$;
revoke all on function public.analytics_ingest_batch(uuid,uuid,uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.analytics_ingest_batch(uuid,uuid,uuid,jsonb,jsonb,text,text) to service_role;

create or replace function public.analytics_claim_bootstrap(p_user_id uuid,p_email text)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$ begin
  update public.analytics_bootstrap set claimed_at=now(),claimed_by=p_user_id where id=true and claimed_at is null;
  if not found then return false; end if;
  insert into public.analytics_admins(user_id,email) values(p_user_id,lower(p_email)) on conflict(user_id) do nothing;
  return true;
end $$;
revoke all on function public.analytics_claim_bootstrap(uuid,text) from public,anon,authenticated;
grant execute on function public.analytics_claim_bootstrap(uuid,text) to service_role;

create or replace function analytix_private.rollup_and_prune()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$ declare e bigint;s bigint;v bigint;p bigint;h bigint;r bigint; begin
  delete from public.analytics_events where received_at<now()-interval '45 days'; get diagnostics e=row_count;
  delete from public.analytics_sessions where last_seen_at<now()-interval '400 days'; get diagnostics s=row_count;
  delete from public.analytics_visitors where last_seen_at<now()-interval '400 days'; get diagnostics v=row_count;
  delete from public.analytics_daily_visitors where day<current_date-400; get diagnostics p=row_count;
  delete from public.analytics_health_history where checked_at<now()-interval '180 days'; get diagnostics h=row_count;
  delete from public.analytics_rate_limits where bucket<now()-interval '2 hours'; get diagnostics r=row_count;
  return jsonb_build_object('events',e,'sessions',s,'visitors',v,'daily_visitors',p,'health',h,'rate_limits',r);
end $$;
revoke all on function analytix_private.rollup_and_prune() from public,anon,authenticated;

insert into public.analytics_bootstrap(id,token_hash)
values(true,'c3a4dfa9dc5838d64f0a6326e9062b026231e9a868777d7dd85f72159ab9e751')
on conflict(id) do nothing;
select public.analytics_force_registry_sync();

alter table public.analytics_projects enable row level security;
alter table public.analytics_admins enable row level security;
alter table public.analytics_bootstrap enable row level security;
alter table public.analytics_internal_settings enable row level security;
alter table public.analytics_visitors enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_daily_visitors enable row level security;
alter table public.analytics_daily_stats enable row level security;
alter table public.analytics_daily_dimensions enable row level security;
alter table public.analytics_errors enable row level security;
alter table public.analytics_performance enable row level security;
alter table public.analytics_campaigns enable row level security;
alter table public.analytics_health enable row level security;
alter table public.analytics_health_history enable row level security;
alter table public.analytics_alerts enable row level security;
alter table public.analytics_rate_limits enable row level security;

do $$ declare t text; begin
  foreach t in array array['analytics_projects','analytics_admins','analytics_bootstrap','analytics_internal_settings','analytics_visitors','analytics_sessions','analytics_events','analytics_daily_visitors','analytics_daily_stats','analytics_daily_dimensions','analytics_errors','analytics_performance','analytics_campaigns','analytics_health','analytics_health_history','analytics_alerts','analytics_rate_limits']
  loop execute format('revoke all on public.%I from anon,authenticated',t); end loop;
end $$;
grant select on public.analytics_projects,public.analytics_sessions,public.analytics_events,public.analytics_daily_stats,public.analytics_daily_dimensions,public.analytics_errors,public.analytics_performance,public.analytics_campaigns,public.analytics_health,public.analytics_health_history,public.analytics_alerts to authenticated;

do $$ declare t text; begin
  foreach t in array array['analytics_projects','analytics_sessions','analytics_events','analytics_daily_stats','analytics_daily_dimensions','analytics_errors','analytics_performance','analytics_campaigns','analytics_health','analytics_health_history','analytics_alerts']
  loop execute format('drop policy if exists analytix_admin_read on public.%I',t); execute format('create policy analytix_admin_read on public.%I for select to authenticated using ((select analytix_private.is_admin()))',t); end loop;
end $$;
