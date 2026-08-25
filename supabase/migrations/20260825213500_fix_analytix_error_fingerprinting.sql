-- Keep the already-deployed ingestion function unchanged except for its fixed,
-- trusted search path. pgcrypto lives in the `extensions` schema on Supabase;
-- including it here lets JS error fallback fingerprints call digest() safely.
alter function public.analytics_ingest_batch(uuid,uuid,uuid,jsonb,jsonb,text,text)
  set search_path = public, extensions, pg_temp;
