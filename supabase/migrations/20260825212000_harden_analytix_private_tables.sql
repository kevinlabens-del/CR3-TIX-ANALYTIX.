-- Make intentional default-deny access explicit and cover every foreign-key lookup.
create index if not exists analytics_bootstrap_claimed_by_idx on public.analytics_bootstrap(claimed_by) where claimed_by is not null;
create index if not exists analytics_events_session_fk_idx on public.analytics_events(project_id,session_id);
create index if not exists analytics_sessions_visitor_fk_idx on public.analytics_sessions(project_id,visitor_id);

do $$
declare t text;
begin
  foreach t in array array['analytics_admins','analytics_bootstrap','analytics_internal_settings','analytics_daily_visitors','analytics_rate_limits','analytics_visitors']
  loop
    execute format('drop policy if exists analytix_no_direct_access on public.%I',t);
    execute format('create policy analytix_no_direct_access on public.%I for all to anon,authenticated using (false) with check (false)',t);
  end loop;
end $$;
