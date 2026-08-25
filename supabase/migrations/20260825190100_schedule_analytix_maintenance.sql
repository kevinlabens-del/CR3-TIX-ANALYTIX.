create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare secret_value text;
begin
  if not exists(select 1 from vault.secrets where name='cr3atix_analytix_health_secret') then
    secret_value:=encode(gen_random_bytes(32),'hex');
    perform vault.create_secret(secret_value,'cr3atix_analytix_health_secret','CR3@TIX ANALYTIX hourly health worker');
    insert into public.analytics_internal_settings(key,value)
    values('health_secret_hash',encode(digest(secret_value,'sha256'),'hex'))
    on conflict(key) do update set value=excluded.value,updated_at=now();
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname in ('cr3atix-analytix-retention','cr3atix-analytix-health');
select cron.schedule('cr3atix-analytix-retention','17 3 * * *',$$select analytix_private.rollup_and_prune();$$);
select cron.schedule('cr3atix-analytix-health','13 * * * *',$schedule$
  select net.http_post(
    url:='https://gwqojqwcbwoulxrctaqz.supabase.co/functions/v1/analytix-health',
    headers:=jsonb_build_object('content-type','application/json','x-analytix-health',(select decrypted_secret from vault.decrypted_secrets where name='cr3atix_analytix_health_secret')),
    body:='{}'::jsonb,
    timeout_milliseconds:=45000
  );
$schedule$);
